FROM python:3.11-slim
WORKDIR /app
COPY . /app
RUN ls -l /app
RUN pip install --no-cache-dir -r requirements.txt
ENV PORT=8080
CMD ["python", "app.py"]
