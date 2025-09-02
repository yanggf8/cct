#!/usr/bin/env python3
"""
Local API Server - Simulates ModelScope deployment
This lets you test the API locally before deploying to ModelScope
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import time
import importlib.util

class LocalModelScopeAPI(BaseHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Load the predictor model
        try:
            spec = importlib.util.spec_from_file_location("simple_inference", "simple_inference.py")
            self.simple_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(self.simple_module)
            self.predictor = self.simple_module.SimplePredictor()
            self.model_loaded = True
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model_loaded = False
        
        super().__init__(*args, **kwargs)
    
    def do_POST(self):
        if self.path == '/predict':
            self.handle_prediction()
        else:
            self.send_error(404, "Endpoint not found")
    
    def do_GET(self):
        if self.path == '/health':
            self.handle_health_check()
        elif self.path == '/':
            self.handle_root()
        else:
            self.send_error(404, "Endpoint not found")
    
    def handle_prediction(self):
        try:
            start_time = time.time()
            
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            if not self.model_loaded:
                raise Exception("Model not loaded")
            
            # Extract price sequence
            price_sequence = request_data.get('price_sequence', [])
            if not price_sequence:
                raise Exception("price_sequence is required")
            
            # Make prediction
            prediction = self.predictor.predict(price_sequence)
            
            # Add API metadata
            end_time = time.time()
            response = {
                'prediction': prediction,
                'metadata': {
                    'latency_ms': round((end_time - start_time) * 1000, 2),
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'api_version': 'local_v1.0',
                    'cost_simulation': 0.02  # Simulated cost
                }
            }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response, indent=2).encode())
            
            # Log the request
            print(f"Prediction request: {len(price_sequence)} prices -> ${prediction['predicted_price']}")
            
        except Exception as e:
            self.send_error(500, f"Prediction failed: {str(e)}")
    
    def handle_health_check(self):
        health_status = {
            'status': 'healthy' if self.model_loaded else 'unhealthy',
            'model_loaded': self.model_loaded,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'uptime': 'local_test'
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(health_status, indent=2).encode())
    
    def handle_root(self):
        html_response = '''
<!DOCTYPE html>
<html>
<head><title>Local ModelScope API Simulator</title></head>
<body>
<h1>🤖 Local ModelScope API Simulator</h1>
<h2>Available Endpoints:</h2>
<ul>
<li><strong>GET /health</strong> - Check API health</li>
<li><strong>POST /predict</strong> - Make stock price prediction</li>
</ul>

<h2>Test Prediction:</h2>
<form id="testForm">
<textarea id="testData" rows="8" cols="50">{
  "price_sequence": [150.0, 151.2, 149.8, 152.1, 153.0]
}</textarea><br><br>
<button type="button" onclick="testPrediction()">Test Prediction</button>
</form>

<h3>Result:</h3>
<pre id="result"></pre>

<script>
function testPrediction() {
  const data = document.getElementById('testData').value;
  fetch('/predict', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: data
  })
  .then(response => response.json())
  .then(data => {
    document.getElementById('result').textContent = JSON.stringify(data, null, 2);
  })
  .catch(error => {
    document.getElementById('result').textContent = 'Error: ' + error;
  });
}
</script>
</body>
</html>
        '''
        
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(html_response.encode())
    
    def log_message(self, format, *args):
        # Custom logging
        print(f"[{time.strftime('%H:%M:%S')}] {format % args}")

def start_local_server(port=8000):
    print("=" * 60)
    print("🚀 Starting Local ModelScope API Simulator")
    print("=" * 60)
    print(f"Server starting on http://localhost:{port}")
    print("Available endpoints:")
    print(f"  • http://localhost:{port}/ (Web interface)")
    print(f"  • http://localhost:{port}/health (Health check)")
    print(f"  • http://localhost:{port}/predict (Prediction API)")
    print()
    print("This simulates the ModelScope API locally for testing")
    print("Press Ctrl+C to stop the server")
    print("=" * 60)
    
    try:
        server = HTTPServer(('localhost', port), LocalModelScopeAPI)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
        server.server_close()

if __name__ == "__main__":
    start_local_server()