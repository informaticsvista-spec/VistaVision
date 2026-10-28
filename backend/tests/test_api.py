"""Integration tests through the real HTTP layer with the real ONNX models."""
import cv2
import pytest

from app.services.model_store import store
from app.services.object_service import COCO_LABELS
from tests.conftest import jpeg, models_installed, render_digits

needs_digit = pytest.mark.skipif(not models_installed("digit"), reason="run: python -m app.models.download")
needs_face = pytest.mark.skipif(not models_installed("face", "emotion"), reason="run: python -m app.models.download")
needs_object = pytest.mark.skipif(not models_installed("object"), reason="run: python -m app.models.download")


def post(client, path, image_bytes, name="photo.jpg", content_type="image/jpeg", **params):
    return client.post(path, params=params, files={"file": (name, image_bytes, content_type)})


def test_health_lists_models(client):
    body = client.get("/api/health").json()
    assert set(body["models"]) == {"face", "emotion", "emotion2", "digit", "digit2", "object"}
    assert body["status"] in {"ok", "degraded"}


def test_supported_object_list_includes_apple_and_banana(client):
    labels = client.get("/api/objects/labels").json()["labels"]
    assert {"Apple", "Banana", "Orange"} <= set(labels)
    assert len(labels) == len(COCO_LABELS) == 80


@pytest.mark.parametrize("path", ["/api/faces/analyze", "/api/objects/detect", "/api/digits/recognize"])
def test_rejects_non_images(client, path):
    response = post(client, path, b"definitely not an image", "notes.txt", "text/plain")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_image"


def test_rejects_unsupported_format(client):
    ok, gif = cv2.imencode(".bmp", render_digits("1"))
    response = post(client, "/api/digits/recognize", gif.tobytes(), "a.bmp", "image/bmp")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_format"


def test_rejects_oversized_upload(client, monkeypatch):
    import app.services.image_io as image_io
    monkeypatch.setattr(image_io, "settings", type("S", (), {"max_upload_bytes": 1024, "max_image_side": 2048})())
    response = post(client, "/api/digits/recognize", jpeg(render_digits("1")))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "image_too_large"


def test_rejects_empty_file(client):
    response = post(client, "/api/digits/recognize", b"")
    assert response.status_code == 400


@needs_digit
@pytest.mark.parametrize("paper", [False, True])
@pytest.mark.parametrize("text", ["0", "1", "2", "3", "4", "5", "7", "8"])
def test_single_digits_are_recognised(client, text, paper):
    response = post(client, "/api/digits/recognize", jpeg(render_digits(text, paper=paper)),
                    source="paper" if paper else "canvas", mode="single")
    assert response.status_code == 200
    body = response.json()
    assert body["number"] == text
    assert 0.0 < body["digits"][0]["confidence"] <= 1.0
    assert body["digits"][0]["tile_png"].startswith("data:image/png;base64,")


@needs_digit
@pytest.mark.parametrize("text", ["43", "123", "907"])
def test_multi_digit_numbers_keep_their_order(client, text):
    body = post(client, "/api/digits/recognize", jpeg(render_digits(text)), source="canvas", mode="multi").json()
    assert body["number"] == text
    assert body["digit_count"] == len(text)
    xs = [d["box"]["x"] for d in body["digits"]]
    assert xs == sorted(xs)


@needs_digit
def test_blank_image_gives_helpful_422(client):
    import numpy as np
    blank = np.full((300, 500, 3), 250, np.uint8)
    response = post(client, "/api/digits/recognize", jpeg(blank), source="paper")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "no_digit_found"


@needs_face
def test_face_detection_and_expression_on_real_photo(client):
    skimage_data = pytest.importorskip("skimage.data")
    photo = cv2.cvtColor(skimage_data.astronaut(), cv2.COLOR_RGB2BGR)
    body = post(client, "/api/faces/analyze", jpeg(photo)).json()
    assert body["face_count"] == 1
    face = body["faces"][0]
    assert 0 <= face["box"]["x"] <= 1 and 0 < face["box"]["w"] <= 1
    expression = face["expression"]
    assert expression["label"] in {"Neutral", "Happy", "Surprise", "Sad", "Angry", "Disgust", "Fear", "Contempt", "Uncertain"}
    assert abs(sum(expression["probabilities"].values()) - 1.0) < 0.01
    assert "estimate" in body["disclaimer"].lower()


@needs_face
def test_uncertain_threshold_marks_low_confidence(client):
    skimage_data = pytest.importorskip("skimage.data")
    photo = cv2.cvtColor(skimage_data.astronaut(), cv2.COLOR_RGB2BGR)
    body = post(client, "/api/faces/analyze", jpeg(photo), uncertain_threshold=1.0).json()
    assert body["faces"][0]["expression"]["label"] == "Uncertain"
    assert body["faces"][0]["expression"]["top_label"] is not None


@needs_face
def test_image_without_faces_returns_empty_list(client):
    import numpy as np
    body = post(client, "/api/faces/analyze", jpeg(np.full((300, 400, 3), 128, np.uint8))).json()
    assert body["face_count"] == 0 and body["faces"] == []


@needs_object
def test_object_detection_finds_a_cup(client):
    skimage_data = pytest.importorskip("skimage.data")
    photo = cv2.cvtColor(skimage_data.coffee(), cv2.COLOR_RGB2BGR)
    body = post(client, "/api/objects/detect", jpeg(photo)).json()
    labels = [d["label"] for d in body["detections"]]
    assert "Cup" in labels
    top = body["detections"][0]
    assert top["confidence"] > 0.5 and 0 <= top["box"]["x"] <= 1


def test_api_can_also_serve_the_built_frontend(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    import app.main as main
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>VistaVision SPA</html>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    monkeypatch.setattr(main, "settings", type("S", (), {"frontend_dist": tmp_path, "cors_origins": [], "cors_origin_regex": None})())
    spa = TestClient(main.create_app())
    assert "VistaVision SPA" in spa.get("/recognition/faces").text      # client-side route falls back to index.html
    assert "console.log" in spa.get("/assets/app.js").text
    assert spa.get("/api/health").json()["version"]                        # API still wins
    assert spa.get("/api/nope").status_code == 404                         # unknown API paths are not swallowed
    assert "VistaVision SPA" in spa.get("/../../etc/passwd").text          # traversal can't escape the folder


def test_bundled_models_match_their_checksums():
    from app.models.download import sha256_of
    from app.models.manifest import MODELS

    for spec in MODELS.values():
        if spec.bundled:
            assert sha256_of(store.path(spec.key)) == spec.sha256


def test_object_detector_uses_yolox_labels(client):
    labels = client.get("/api/objects/labels").json()["labels"]
    assert "Person" in labels and "Teddy bear" in labels
