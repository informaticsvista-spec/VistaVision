"""Pinned model files, their sources and SHA-256 checksums.

All models are pretrained, openly published models. The checksums were
recorded when the files were downloaded for testing; the downloader refuses a
file whose checksum differs, so you always run exactly the models that were tested.
"""
from __future__ import annotations

from dataclasses import dataclass

ZOO_MEDIA = "https://media.githubusercontent.com/media"


@dataclass(frozen=True)
class ModelSpec:
    key: str
    filename: str
    url: str
    sha256: str
    purpose: str
    license: str
    bundled: bool = False  # shipped inside the project (app/models/bundled) instead of downloaded


MODELS: dict[str, ModelSpec] = {
    "face": ModelSpec(
        key="face",
        filename="face_detection_yunet_2023mar.onnx",
        url=f"{ZOO_MEDIA}/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        sha256="8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
        purpose="Multi-face detection (YuNet, OpenCV Zoo)",
        license="MIT",
    ),
    "emotion": ModelSpec(
        key="emotion",
        filename="emotion-ferplus-8.onnx",
        url=f"{ZOO_MEDIA}/onnx/models/main/validated/vision/body_analysis/emotion_ferplus/model/emotion-ferplus-8.onnx",
        sha256="a2a2ba6a335a3b29c21acb6272f962bd3d47f84952aaffa03b60986e04efa61c",
        purpose="Visible facial-expression estimate (FER+, ONNX Model Zoo)",
        license="MIT",
    ),
    "digit": ModelSpec(
        key="digit",
        filename="mnist-12.onnx",
        url=f"{ZOO_MEDIA}/onnx/models/main/validated/vision/classification/mnist/model/mnist-12.onnx",
        sha256="5c688690f8bacf667d4c2074af5ad0646ca328d7ab03eccf944a65b320171bdd",
        purpose="Handwritten digit classifier trained on MNIST (ONNX Model Zoo)",
        license="MIT",
    ),
    "object": ModelSpec(
        key="object",
        filename="object_detection_yolox_2022nov.onnx",
        url=f"{ZOO_MEDIA}/opencv/opencv_zoo/main/models/object_detection_yolox/object_detection_yolox_2022nov.onnx",
        sha256="c5c2d13e59ae883e6af3b45daea64af4833a4951c92d116ec270d9ddbe998063",
        purpose="Object detection, 80 COCO classes (YOLOX-S, OpenCV Zoo) - about twice the accuracy of SSD MobileNet v1",
        license="Apache-2.0",
    ),
    "emotion2": ModelSpec(
        key="emotion2",
        filename="facial_expression_recognition_mobilefacenet_2022july.onnx",
        url=f"{ZOO_MEDIA}/opencv/opencv_zoo/main/models/facial_expression_recognition/facial_expression_recognition_mobilefacenet_2022july.onnx",
        sha256="4f61307602fc089ce20488a31d4e4614e3c9753a7d6c41578c854858b183e1a9",
        purpose="Expression estimate on aligned faces, trained on in-the-wild RAF-DB (OpenCV Zoo)",
        license="Apache-2.0",
    ),
    "digit2": ModelSpec(
        key="digit2",
        filename="vista_digits_cnn.onnx",
        url="",
        sha256="df1535e973336d52c7f901b06ade3cb9c7557e50d5c4aa37c1c826766fc986b2",
        purpose="VistaVision handwriting CNN trained on augmented MNIST + font-rendered digits (ships with the project)",
        license="MIT (trained by this project on MNIST)",
        bundled=True,
    ),
}
