#!/usr/bin/env python3
"""
Test ONNX Model Conversion and Performance
Validates LSTM model for Cloudflare Workers AI deployment
"""

import numpy as np
import onnxruntime as ort
import torch
import time
import json
import os
from simple_lstm_model import FinancialLSTMPredictor, generate_sample_data

def test_onnx_model(onnx_path, pytorch_model, test_data, num_tests=10):
    """
    Test ONNX model performance and accuracy vs PyTorch
    
    Args:
        onnx_path: Path to ONNX model
        pytorch_model: Original PyTorch model
        test_data: Test input data
        num_tests: Number of performance tests
    """
    print("🧪 Testing ONNX Model Conversion and Performance")
    print("=" * 60)
    
    # Load ONNX model
    print("📂 Loading ONNX model...")
    ort_session = ort.InferenceSession(onnx_path)
    
    # Get model info
    input_name = ort_session.get_inputs()[0].name
    output_name = ort_session.get_outputs()[0].name
    
    print(f"   Input name: {input_name}")
    print(f"   Output name: {output_name}")
    
    # Test model size
    model_size_mb = os.path.getsize(onnx_path) / (1024 * 1024)
    print(f"   Model size: {model_size_mb:.2f} MB")
    
    # Prepare test input
    test_input = test_data[:5].numpy()  # Take 5 samples for testing
    
    print(f"\n🔄 Running accuracy comparison...")
    
    # PyTorch prediction
    pytorch_model.eval()
    with torch.no_grad():
        pytorch_output = pytorch_model(test_data[:5]).numpy()
    
    # ONNX prediction
    onnx_output = ort_session.run([output_name], {input_name: test_input})[0]
    
    # Compare outputs
    max_diff = np.max(np.abs(pytorch_output - onnx_output))
    mean_diff = np.mean(np.abs(pytorch_output - onnx_output))
    
    print(f"   Max difference: {max_diff:.8f}")
    print(f"   Mean difference: {mean_diff:.8f}")
    print(f"   Accuracy match: {'✅ PASS' if max_diff < 1e-5 else '❌ FAIL'}")
    
    # Performance testing
    print(f"\n⚡ Running performance tests ({num_tests} iterations)...")
    
    # PyTorch timing
    pytorch_times = []
    for _ in range(num_tests):
        start_time = time.time()
        with torch.no_grad():
            _ = pytorch_model(test_data[:1])
        pytorch_times.append((time.time() - start_time) * 1000)  # Convert to ms
    
    # ONNX timing
    onnx_times = []
    single_input = test_input[:1]
    for _ in range(num_tests):
        start_time = time.time()
        _ = ort_session.run([output_name], {input_name: single_input})
        onnx_times.append((time.time() - start_time) * 1000)  # Convert to ms
    
    pytorch_avg = np.mean(pytorch_times)
    pytorch_std = np.std(pytorch_times)
    onnx_avg = np.mean(onnx_times)
    onnx_std = np.std(onnx_times)
    
    print(f"   PyTorch: {pytorch_avg:.2f} ± {pytorch_std:.2f} ms")
    print(f"   ONNX:    {onnx_avg:.2f} ± {onnx_std:.2f} ms")
    print(f"   Speedup: {pytorch_avg/onnx_avg:.2f}x")
    
    # Check if suitable for edge deployment
    edge_suitable = (
        model_size_mb < 10 and  # Size constraint
        onnx_avg < 100 and      # Latency constraint
        max_diff < 1e-5         # Accuracy constraint
    )
    
    print(f"\n🎯 Edge Deployment Assessment:")
    print(f"   Size suitable (<10MB): {'✅' if model_size_mb < 10 else '❌'} {model_size_mb:.2f}MB")
    print(f"   Speed suitable (<100ms): {'✅' if onnx_avg < 100 else '❌'} {onnx_avg:.2f}ms")
    print(f"   Accuracy suitable: {'✅' if max_diff < 1e-5 else '❌'}")
    print(f"   Overall: {'✅ READY FOR EDGE DEPLOYMENT' if edge_suitable else '❌ NEEDS OPTIMIZATION'}")
    
    return {
        'model_size_mb': model_size_mb,
        'accuracy_diff': {'max': max_diff, 'mean': mean_diff},
        'performance_ms': {'pytorch': pytorch_avg, 'onnx': onnx_avg},
        'speedup': pytorch_avg/onnx_avg,
        'edge_suitable': edge_suitable
    }

def create_cloudflare_deployment_spec(test_results, config_path='lstm_financial_artifacts/config.json'):
    """
    Create deployment specification for Cloudflare Workers AI
    """
    print("\n📋 Creating Cloudflare Deployment Specification...")
    
    # Load model config
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    deployment_spec = {
        "model_info": {
            "name": "simple-lstm-financial",
            "version": "1.0.0",
            "description": "Lightweight LSTM model for financial time series prediction",
            "task_type": "time-series-forecasting",
            "framework": "pytorch",
            "export_format": "onnx"
        },
        "technical_specs": {
            "model_size_mb": test_results['model_size_mb'],
            "inference_time_ms": test_results['performance_ms']['onnx'],
            "memory_usage": "estimated_low",
            "input_shape": [1, config['sequence_length'], len(config['feature_columns'])],
            "output_shape": [1, 1],
            "opset_version": 11
        },
        "performance_metrics": {
            "accuracy_validated": bool(test_results['accuracy_diff']['max'] < 1e-5),
            "speedup_vs_pytorch": f"{test_results['speedup']:.2f}x",
            "edge_deployment_ready": bool(test_results['edge_suitable'])
        },
        "deployment_requirements": {
            "custom_requirements_form": "required",
            "enterprise_contact": "required", 
            "estimated_timeline": "6-12 weeks",
            "prerequisites": [
                "Cloudflare Enterprise account",
                "Custom Requirements Form submission",
                "Technical review with Cloudflare AI team"
            ]
        },
        "use_case": {
            "description": "Financial time series prediction for trading system",
            "input_data": "OHLCV financial data (30-day sequences)",
            "output_data": "Next day price prediction",
            "latency_requirement": "<200ms",
            "throughput_requirement": "300 requests/minute"
        }
    }
    
    # Save deployment spec
    with open('cloudflare_deployment_spec.json', 'w') as f:
        json.dump(deployment_spec, f, indent=2)
    
    print("   📄 Deployment spec saved: cloudflare_deployment_spec.json")
    
    return deployment_spec

def generate_custom_requirements_form_data(deployment_spec):
    """
    Generate data for Cloudflare Custom Requirements Form
    """
    print("\n📝 Generating Custom Requirements Form Data...")
    
    form_data = {
        "contact_info": {
            "company": "Trading System Company",
            "use_case": "Financial time series prediction for trading signals",
            "expected_usage": "300 requests/minute, 24/7 operation"
        },
        "model_requirements": {
            "model_type": "Custom LSTM for financial prediction",
            "model_size": f"{deployment_spec['technical_specs']['model_size_mb']:.2f}MB",
            "inference_requirements": f"<{deployment_spec['technical_specs']['inference_time_ms']:.0f}ms latency",
            "input_format": "OHLCV financial time series data",
            "output_format": "Price predictions with confidence scores"
        },
        "technical_requirements": {
            "availability": "99.9% uptime required",
            "scaling": "Auto-scaling based on market hours",
            "security": "Financial data processing compliance",
            "integration": "REST API integration with existing trading system"
        },
        "business_requirements": {
            "timeline": "POC in 6-8 weeks, production in 12 weeks",
            "budget": "Enterprise tier acceptable",
            "compliance": "Financial services compliance required"
        }
    }
    
    with open('custom_requirements_form_data.json', 'w') as f:
        json.dump(form_data, f, indent=2)
    
    print("   📄 Form data saved: custom_requirements_form_data.json")
    print(f"\n📞 Next Steps:")
    print(f"   1. Visit: https://www.cloudflare.com/lp/workers-ai/")
    print(f"   2. Submit Custom Requirements Form")
    print(f"   3. Attach: cloudflare_deployment_spec.json")
    print(f"   4. Reference: custom_requirements_form_data.json")
    
    return form_data

def main():
    """
    Main testing function
    """
    print("🔍 ONNX Model Validation and Cloudflare Deployment Assessment")
    print("=" * 70)
    
    # Check if model files exist
    onnx_path = 'simple_lstm_financial.onnx'
    config_path = 'lstm_financial_artifacts/config.json'
    
    if not os.path.exists(onnx_path):
        print("❌ ONNX model not found. Run simple_lstm_model.py first.")
        return
    
    if not os.path.exists(config_path):
        print("❌ Model config not found. Run simple_lstm_model.py first.")
        return
    
    # Generate test data
    print("📊 Generating test data...")
    data = generate_sample_data(days=100)
    predictor = FinancialLSTMPredictor(sequence_length=30)
    X_test, _ = predictor.prepare_data(data)
    
    # Recreate PyTorch model for comparison
    print("🤖 Loading PyTorch model for comparison...")
    predictor.create_model(input_size=X_test.shape[2])
    predictor.model.load_state_dict(torch.load('lstm_financial_artifacts/model_weights.pth'))
    
    # Test ONNX model
    test_results = test_onnx_model(onnx_path, predictor.model, X_test)
    
    # Create deployment specs
    deployment_spec = create_cloudflare_deployment_spec(test_results, config_path)
    form_data = generate_custom_requirements_form_data(deployment_spec)
    
    # Convert numpy booleans to Python native booleans for JSON serialization
    test_results['edge_suitable'] = bool(test_results['edge_suitable'])
    deployment_spec['performance_metrics']['accuracy_validated'] = bool(deployment_spec['performance_metrics']['accuracy_validated'])
    deployment_spec['performance_metrics']['edge_deployment_ready'] = bool(deployment_spec['performance_metrics']['edge_deployment_ready'])
    
    # Summary
    print(f"\n✅ ONNX Model Validation Complete!")
    print(f"   📊 Model Performance: {'READY' if test_results['edge_suitable'] else 'NEEDS_WORK'}")
    print(f"   📁 Files Generated:")
    print(f"      - cloudflare_deployment_spec.json")
    print(f"      - custom_requirements_form_data.json")
    
    if test_results['edge_suitable']:
        print(f"\n🚀 READY FOR CLOUDFLARE ENTERPRISE CONTACT!")
    else:
        print(f"\n⚠️  Model needs optimization before deployment")
    
    return test_results, deployment_spec, form_data

if __name__ == "__main__":
    test_results, deployment_spec, form_data = main()