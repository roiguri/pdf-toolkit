from flask import Flask, request, send_file
from flask_cors import CORS
import subprocess
import os
import uuid
import io
import numpy as np
import cv2
from PIL import Image
import img2pdf

app = Flask(__name__)
CORS(app)

@app.route('/compress', methods=['POST'])
def compress_pdf():
    if 'file' not in request.files:
        return 'No file part', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400

    # Get compression level from the form data
    compression_level = request.form.get('level', 'ebook')

    filename = str(uuid.uuid4())
    input_path = os.path.join('/tmp', f'{filename}.pdf')
    output_path = os.path.join('/tmp', f'{filename}_compressed.pdf')
    file.save(input_path)

    # Ghostscript command with different settings for compression level
    gs_command = [
        'gs',
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        f'-dPDFSETTINGS=/{compression_level}',
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        f'-sOutputFile={output_path}',
        input_path
    ]

    try:
        subprocess.run(gs_command, check=True)
        return send_file(output_path, as_attachment=True, download_name='compressed.pdf')
    except subprocess.CalledProcessError as e:
        return f'Error compressing PDF: {e}', 500
    finally:
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)

@app.route('/render', methods=['POST'])
def render_pdf_page():
    if 'file' not in request.files:
        return 'No file part', 400
    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400

    try:
        page = int(request.form.get('page', 1))
    except ValueError:
        return 'Invalid page number', 400

    filename = str(uuid.uuid4())
    input_path = os.path.join('/tmp', f'{filename}.pdf')
    output_path = os.path.join('/tmp', f'{filename}_page.png')
    file.save(input_path)

    gs_command = [
        'gs',
        '-dBATCH',
        '-dNOPAUSE',
        '-dQUIET',
        '-sDEVICE=png16m',
        '-r150',
        f'-dFirstPage={page}',
        f'-dLastPage={page}',
        f'-sOutputFile={output_path}',
        input_path
    ]

    try:
        subprocess.run(gs_command, check=True)
        return send_file(output_path, mimetype='image/png', download_name='page.png')
    except subprocess.CalledProcessError as e:
        return f'Error rendering PDF: {e}', 500
    finally:
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)


def order_points(pts):
    """Order corner points: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype='float32')
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def _normalize_line(rho, theta):
    """Ensure rho >= 0 by flipping sign and shifting theta."""
    if rho < 0:
        rho, theta = -rho, theta + np.pi
    return rho, theta


def _line_intersection(line1, line2):
    """Compute (x, y) intersection of two (rho, theta) Hough lines. Returns None if parallel."""
    rho1, theta1 = line1
    rho2, theta2 = line2
    ct1, st1 = np.cos(theta1), np.sin(theta1)
    ct2, st2 = np.cos(theta2), np.sin(theta2)
    det = ct1 * st2 - st1 * ct2
    if abs(det) < 1e-6:
        return None
    x = (rho1 * st2 - rho2 * st1) / det
    y = (rho2 * ct1 - rho1 * ct2) / det
    return (x, y)


def _pick_representative(group):
    """Return the line whose rho is closest to the group median — robust to outliers."""
    if not group:
        return None
    rhos = [r for r, _ in group]
    median_rho = float(np.median(rhos))
    idx = int(np.argmin([abs(r - median_rho) for r in rhos]))
    return group[idx]


def _validate_quad(pts, img_w, img_h):
    """Return True if pts form a plausible document quad near the image frame."""
    mx, my = 0.5 * img_w, 0.5 * img_h
    for x, y in pts:
        if not (-mx <= x <= img_w + mx and -my <= y <= img_h + my):
            return False
    arr = np.array(pts, dtype='float64')
    area = 0.5 * abs(
        np.dot(arr[:, 0], np.roll(arr[:, 1], 1)) -
        np.dot(arr[:, 1], np.roll(arr[:, 0], 1))
    )
    if not (0.10 * img_w * img_h <= area <= 0.99 * img_w * img_h):
        return False
    # Reject extremely thin or wide quads (not document-shaped)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    ratio = (max(xs) - min(xs)) / max(max(ys) - min(ys), 1)
    return 0.2 <= ratio <= 5.0


def _get_brightness_mask(gray_small, img_w, img_h):
    """
    Compute Otsu brightness mask with morphological close to fill internal holes.
    Uses a moderate kernel — large enough to fill text holes but small enough to
    avoid bridging the document to nearby image borders.
    Returns binary mask (uint8, same size as gray_small).
    """
    blurred = cv2.GaussianBlur(gray_small, (5, 5), 0)
    _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Use ~5% of the shorter dimension — fills text holes without over-expanding
    ksize = max(20, min(img_w, img_h) // 20)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (ksize, ksize))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask


def _boundary_hough_detect(gray_small, edges, img_w, img_h):
    """
    Primary detection: brightness mask locates approximate document boundary;
    Hough runs only in a narrow strip around that boundary for precision.
    Sides where the document is flush with the image border (no visible edge)
    are substituted with synthetic image-border lines.
    Returns (4,2) float32 array or None.
    """
    mask = _get_brightness_mask(gray_small, img_w, img_h)

    # Detect which sides the document is flush against (>70% border coverage)
    FLUSH = 0.7
    top_flush    = np.mean(mask[0,  :] == 255) > FLUSH
    bottom_flush = np.mean(mask[-1, :] == 255) > FLUSH
    left_flush   = np.mean(mask[:,  0] == 255) > FLUSH
    right_flush  = np.mean(mask[:, -1] == 255) > FLUSH

    # Build boundary band around the mask
    band_px = max(15, min(img_w, img_h) // 25)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (band_px * 2 + 1, band_px * 2 + 1))
    boundary_band = cv2.subtract(cv2.dilate(mask, k), cv2.erode(mask, k))
    boundary_edges = cv2.bitwise_and(edges, edges, mask=boundary_band)

    lines = cv2.HoughLines(boundary_edges, rho=1, theta=np.pi / 180, threshold=80)
    if lines is None:
        return None
    lines_norm = [_normalize_line(r, t) for r, t in lines[:, 0, :]]

    # Tight angle bands — only accept lines within 20° of axis-aligned.
    # Use t % pi for classification because _normalize_line can produce theta > pi.
    H_LO     = np.pi * 70 / 180   # 70°
    H_HI     = np.pi * 110 / 180  # 110°
    V_THRESH = np.pi * 20 / 180   # 20°

    # vert  = near-horizontal lines (theta_mod near 90°), rho = y-position
    # horiz = near-vertical   lines (theta_mod near 0° or 180°), rho = x-position
    vert  = sorted([(r, t) for r, t in lines_norm if H_LO <= (t % np.pi) <= H_HI],
                   key=lambda x: x[0])
    horiz = sorted([(r, t) for r, t in lines_norm
                    if (t % np.pi) <= V_THRESH or (t % np.pi) >= np.pi - V_THRESH],
                   key=lambda x: x[0])

    # Split by image midpoint so flush sides don't pollute the opposite side's group
    top_group    = [(r, t) for r, t in vert  if r < img_h / 2]
    bottom_group = [(r, t) for r, t in vert  if r >= img_h / 2]
    left_group   = [(r, t) for r, t in horiz if r < img_w / 2]
    right_group  = [(r, t) for r, t in horiz if r >= img_w / 2]

    def _pick(group, flush, border_rho, border_theta):
        if group:
            return _pick_representative(group)
        if flush:
            return (border_rho, border_theta)
        return None

    top_line    = _pick(top_group,    top_flush,    0.0,          np.pi / 2)
    bottom_line = _pick(bottom_group, bottom_flush, float(img_h), np.pi / 2)
    left_line   = _pick(left_group,   left_flush,   0.0,          0.0)
    right_line  = _pick(right_group,  right_flush,  float(img_w), 0.0)

    if None in (top_line, bottom_line, left_line, right_line):
        return None

    tl = _line_intersection(top_line, left_line)
    tr = _line_intersection(top_line, right_line)
    br = _line_intersection(bottom_line, right_line)
    bl = _line_intersection(bottom_line, left_line)

    if None in (tl, tr, br, bl):
        return None
    if not _validate_quad([tl, tr, br, bl], img_w, img_h):
        return None

    return np.array([tl, tr, br, bl], dtype='float32')


def _brightness_fallback(gray_small, img_w, img_h):
    """
    Last-resort detection using the brightness mask contour directly.
    Less precise than Hough but always produces 4 corners when the document
    is clearly brighter than its background.
    Returns (4,2) float32 array or None.
    """
    mask = _get_brightness_mask(gray_small, img_w, img_h)
    # Extra close pass with larger kernel for this fallback
    ksize = max(50, min(img_w, img_h) // 10)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (ksize, ksize))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    if not (0.10 * img_w * img_h <= area <= 0.97 * img_w * img_h):
        return None

    hull = cv2.convexHull(largest)
    peri = cv2.arcLength(hull, True)

    for eps in [0.02, 0.04, 0.06, 0.08, 0.10, 0.15]:
        approx = cv2.approxPolyDP(hull, eps * peri, True)
        if len(approx) == 4:
            corners = approx.reshape(4, 2).astype('float32')
            if _validate_quad(corners.tolist(), img_w, img_h):
                return corners

    rect = cv2.minAreaRect(largest)
    box = cv2.boxPoints(rect).astype('float32')
    if _validate_quad(box.tolist(), img_w, img_h):
        return box

    return None


def _hough_detect(edges, img_w, img_h):
    """
    Primary detection: Standard Hough Transform finds infinite lines,
    clusters into top/bottom/left/right, computes 4 corner intersections.
    Works even when document corners are outside the image frame.
    Returns (4,2) float32 array or None.
    """
    lines = cv2.HoughLines(edges, rho=1, theta=np.pi / 180, threshold=80)
    if lines is None or len(lines) < 4:
        return None

    lines = [_normalize_line(r, t) for r, t in lines[:, 0, :]]

    # Cluster by angle: vertical band 60°–120°, rest is horizontal
    V_LO, V_HI = np.pi / 3, 2 * np.pi / 3
    horiz = [(r, t) for r, t in lines if not (V_LO <= t <= V_HI)]
    vert  = [(r, t) for r, t in lines if V_LO <= t <= V_HI]

    if len(horiz) < 2 or len(vert) < 2:
        return None

    horiz.sort(key=lambda x: x[0])
    vert.sort(key=lambda x: x[0])

    mid_h, mid_v = len(horiz) // 2, len(vert) // 2
    top_line    = _pick_representative(horiz[:mid_h] or [horiz[0]])
    bottom_line = _pick_representative(horiz[mid_h:] or [horiz[-1]])
    left_line   = _pick_representative(vert[:mid_v]  or [vert[0]])
    right_line  = _pick_representative(vert[mid_v:]  or [vert[-1]])

    tl = _line_intersection(top_line, left_line)
    tr = _line_intersection(top_line, right_line)
    br = _line_intersection(bottom_line, right_line)
    bl = _line_intersection(bottom_line, left_line)

    if None in (tl, tr, br, bl):
        return None
    if not _validate_quad([tl, tr, br, bl], img_w, img_h):
        return None

    return np.array([tl, tr, br, bl], dtype='float32')


def _contour_detect(edges_dilated, img_w, img_h):
    """
    Fallback detection: finds the largest 4-point contour.
    Works well for fully-framed documents with clear boundaries.
    Returns (4,2) float32 array or None.
    """
    image_area = img_w * img_h
    contours, _ = cv2.findContours(edges_dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    for c in contours[:10]:
        area = cv2.contourArea(c)
        if area < 0.20 * image_area or area > 0.99 * image_area:
            continue
        hull = cv2.convexHull(c)
        peri = cv2.arcLength(hull, True)
        approx = cv2.approxPolyDP(hull, 0.01 * peri, True)
        if len(approx) == 4:
            return approx.reshape(4, 2).astype('float32')
    return None


def _preprocess(img_array):
    """Shared preprocessing: downscale, CLAHE, blur, Canny. Returns (small, edges, edges_dilated, scale)."""
    h, w = img_array.shape[:2]
    scale = min(1.0, 1200 / max(h, w))
    small = cv2.resize(img_array, (int(w * scale), int(h * scale)))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 30, 100)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    edges_dilated = cv2.dilate(edges, kernel, iterations=1)
    return small, edges, edges_dilated, scale


def detect_corners(img_array):
    """
    Detect document corners in original image coordinates.
    Returns (corners, detected) where corners is a (4,2) float32 array
    ordered [TL, TR, BR, BL], or the full-image corners if not detected.
    """
    orig = img_array.copy()
    h, w = orig.shape[:2]
    small, edges, edges_dilated, scale = _preprocess(orig)
    sh, sw = small.shape[:2]
    gray_small = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    # 1. Boundary-band Hough: brightness mask gates which edges Hough sees
    corners_small = _boundary_hough_detect(gray_small, edges, sw, sh)
    # 2. Raw Hough on all edges (handles cases where brightness mask is unreliable)
    if corners_small is None:
        corners_small = _hough_detect(edges, sw, sh)
    # 3. Contour on dilated edges
    if corners_small is None:
        corners_small = _contour_detect(edges_dilated, sw, sh)
    # 4. Brightness mask contour fallback (least precise)
    if corners_small is None:
        corners_small = _brightness_fallback(gray_small, sw, sh)
    detected = corners_small is not None

    if detected:
        pts = corners_small / scale
        corners = order_points(pts)
    else:
        # Fall back to full image corners
        corners = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype='float32')

    return corners, detected


def warp_with_corners(img_array, corners, enhance=False):
    """Apply perspective correction using the given (4,2) corner array [TL,TR,BR,BL]."""
    tl, tr, br, bl = corners
    width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))

    if width < 50 or height < 50:
        return img_array

    dst = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype='float32')
    M = cv2.getPerspectiveTransform(corners, dst)
    warped = cv2.warpPerspective(img_array, M, (width, height))

    if enhance:
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        warped = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10
        )
    return warped


def detect_and_correct(img_array, enhance=True, explicit_corners=None):
    """
    Full pipeline: detect corners (or use explicit ones) and warp.
    If explicit_corners provided (shape (4,2)), skips detection.
    Enhancement only applied when detection succeeded or corners were explicit.
    """
    if explicit_corners is not None:
        corners = order_points(np.array(explicit_corners, dtype='float32'))
        detected = True
    else:
        corners, detected = detect_corners(img_array)

    if not detected:
        return img_array

    return warp_with_corners(img_array, corners, enhance=enhance and detected)


def _img_to_jpeg_bytes(img_array):
    """Convert OpenCV image (BGR or grayscale) to JPEG bytes."""
    if len(img_array.shape) == 2:
        pil_img = Image.fromarray(img_array).convert('RGB')
    else:
        pil_img = Image.fromarray(cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    pil_img.save(buf, format='JPEG', quality=95)
    return buf.getvalue()


@app.route('/detect', methods=['POST'])
def detect_document():
    """
    Return detected document corners as JSON.
    Used by the web UI to show draggable corner handles before scanning.
    """
    if 'file' not in request.files or request.files['file'].filename == '':
        return {'error': 'No file provided'}, 400

    file_bytes = np.frombuffer(request.files['file'].read(), dtype=np.uint8)
    img_array = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if img_array is None:
        return {'error': 'Could not decode image'}, 400

    h, w = img_array.shape[:2]
    corners, detected = detect_corners(img_array)

    return {
        'corners': corners.tolist() if detected else None,
        'width': w,
        'height': h,
    }


@app.route('/scan', methods=['POST'])
def scan_images():
    """
    Convert one or more images to a scanned PDF.
    Accepts optional explicit corners per image (corners_0, corners_1, ...) as
    comma-separated "x1,y1,x2,y2,x3,y3,x4,y4" strings (TL,TR,BR,BL order).
    If no corners provided for an image, auto-detection is used.
    """
    images = request.files.getlist('images')
    if not images or all(img.filename == '' for img in images):
        return 'No images provided', 400

    enhance = request.form.get('enhance', 'true').lower() != 'false'

    pdf_images = []
    for i, img_file in enumerate(images):
        file_bytes = np.frombuffer(img_file.read(), dtype=np.uint8)
        img_array = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if img_array is None:
            return f'Could not decode image: {img_file.filename}', 400

        # Parse explicit corners if provided
        explicit_corners = None
        corners_str = request.form.get(f'corners_{i}')
        if corners_str:
            try:
                vals = [float(v) for v in corners_str.split(',')]
                if len(vals) == 8:
                    explicit_corners = [[vals[j], vals[j+1]] for j in range(0, 8, 2)]
            except ValueError:
                return f'Invalid corners format for image {i}', 400

        processed = detect_and_correct(img_array, enhance=enhance, explicit_corners=explicit_corners)
        pdf_images.append(_img_to_jpeg_bytes(processed))

    try:
        pdf_bytes = img2pdf.convert(pdf_images)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name='scanned.pdf'
        )
    except Exception as e:
        return f'Error creating PDF: {e}', 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
