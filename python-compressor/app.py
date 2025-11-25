from flask import Flask, request, send_file
from flask_cors import CORS
import subprocess
import os
import uuid

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
