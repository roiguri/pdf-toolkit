FROM python:3.13-slim

WORKDIR /usr/src/app

# Pull the latest security patches and install runtime deps.
# Ghostscript here comes from Debian Bookworm; CVEs are addressed via
# bookworm-security updates pulled in by `apt-get upgrade`.
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends \
       ghostscript \
       libgl1 \
       libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["python", "app.py"]
