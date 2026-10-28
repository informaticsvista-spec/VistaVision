"""Unit tests for the model-free preprocessing: no ONNX files needed."""
import cv2
import numpy as np
import pytest

from app.errors import ApiError
from app.services.digit_preprocess import extract_digits, to_mnist_tile
from tests.conftest import render_digits


def test_tile_is_mnist_shaped_and_centred():
    stroke = np.zeros((120, 40), np.uint8)
    cv2.line(stroke, (20, 5), (20, 115), 255, 6)  # a plain "1"
    tile = to_mnist_tile(stroke)
    assert tile.shape == (28, 28) and tile.dtype == np.float32
    assert 0.0 <= tile.min() and tile.max() <= 1.0
    rows, cols = np.indices(tile.shape)
    assert abs((rows * tile).sum() / tile.sum() - 13.5) < 1.0
    assert abs((cols * tile).sum() / tile.sum() - 13.5) < 1.0
    ys, xs = np.nonzero(tile > 0.05)
    assert ys.max() - ys.min() + 1 <= 22  # fits the 20 px box (plus anti-aliasing)


def test_thin_strokes_are_thickened():
    thin = np.zeros((200, 120), np.uint8)
    cv2.circle(thin, (60, 100), 70, 255, 2)
    thick = np.zeros((200, 120), np.uint8)
    cv2.circle(thick, (60, 100), 70, 255, 16)
    assert to_mnist_tile(thin).sum() > 0.6 * to_mnist_tile(thick).sum()


@pytest.mark.parametrize("text,count", [("7", 1), ("43", 2), ("123", 3), ("2026", 4)])
@pytest.mark.parametrize("paper", [False, True])
def test_digits_are_segmented_left_to_right(text, count, paper):
    result = extract_digits(render_digits(text, paper=paper), source="paper" if paper else "canvas", mode="multi")
    assert len(result.crops) == count
    xs = [crop.box[0] for crop in result.crops]
    assert xs == sorted(xs)


def test_single_mode_returns_one_tile():
    result = extract_digits(render_digits("43"), source="canvas", mode="single")
    assert len(result.crops) == 1


def test_blank_paper_raises_friendly_error():
    blank = np.full((400, 600, 3), 235, np.uint8)
    with pytest.raises(ApiError) as caught:
        extract_digits(blank, source="paper")
    assert caught.value.code == "no_digit_found"


def test_blank_canvas_raises_friendly_error():
    with pytest.raises(ApiError):
        extract_digits(np.full((300, 600, 3), 255, np.uint8), source="canvas")


def test_specks_are_ignored():
    image = render_digits("5", paper=False)
    for x, y in [(30, 30), (850, 60), (100, 450)]:
        cv2.circle(image, (x, y), 3, (0, 0, 0), -1)
    assert len(extract_digits(image, source="canvas").crops) == 1


def test_page_border_is_ignored():
    image = render_digits("8", paper=True)
    cv2.rectangle(image, (0, 0), (899, 499), (40, 40, 40), 6)  # dark table edge around the page
    assert len(extract_digits(image, source="paper").crops) == 1


@pytest.mark.parametrize("text,count", [("43", 2), ("123", 3), ("2026", 4)])
def test_touching_digits_are_still_separated(text, count):
    """Heavy strokes with tight spacing make digits touch; they must still be split."""
    image = render_digits(text, thickness=16, size=3.0)
    cv2.putText(image, "", (0, 0), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 1)
    shrunk = cv2.resize(image, (640, 356), interpolation=cv2.INTER_AREA)
    assert len(extract_digits(shrunk, source="canvas").crops) == count


def test_wide_single_digit_is_not_split():
    wide_zero = np.full((400, 600, 3), 255, np.uint8)
    cv2.ellipse(wide_zero, (300, 200), (120, 110), 0, 0, 360, (20, 20, 20), 14)
    assert len(extract_digits(wide_zero, source="canvas").crops) == 1
