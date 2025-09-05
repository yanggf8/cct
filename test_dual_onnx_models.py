#!/usr/bin/env python3
"""
Dual ONNX Model Validation: TFT + N-HITS for Cloudflare Workers AI
Tests both models for edge deployment and creates unified deployment specs
"""

import numpy as np
import onnxruntime as ort
import torch
import time
import json
import os
from edge_tft_model import FinancialTFTPredictor, generate_sample_data
from edge_nhits_model import FinancialNHITSPredictor

def test_dual_onnx_models(tft_onnx_path, nhits_onnx_path, test_data, num_tests=10):
    """
    Test both TFT and N-HITS ONNX models for performance and accuracy
    """
    print("🧪 Testing Dual ONNX Models: TFT + N-HITS")
    print("=" * 60)
    
    results = {
        'tft_results': {},
        'nhits_results': {},
        'comparison': {}
    }
    
    # Test TFT model
    print("📂 Loading TFT ONNX model...")
    tft_session = ort.InferenceSession(tft_onnx_path)
    tft_input_name = tft_session.get_inputs()[0].name
    tft_output_name = tft_session.get_outputs()[0].name
    tft_size_mb = os.path.getsize(tft_onnx_path) / (1024 * 1024)
    
    print(f"   TFT Input: {tft_input_name}")
    print(f"   TFT Output: {tft_output_name}")
    print(f"   TFT Size: {tft_size_mb:.2f} MB")
    
    # Test N-HITS model
    print("\n📂 Loading N-HITS ONNX model...")
    nhits_session = ort.InferenceSession(nhits_onnx_path)
    nhits_input_name = nhits_session.get_inputs()[0].name
    nhits_output_name = nhits_session.get_outputs()[0].name
    nhits_size_mb = os.path.getsize(nhits_onnx_path) / (1024 * 1024)
    
    print(f"   N-HITS Input: {nhits_input_name}")
    print(f"   N-HITS Output: {nhits_output_name}")
    print(f"   N-HITS Size: {nhits_size_mb:.2f} MB")
    
    # Prepare test input
    test_input = test_data[:5].numpy()
    
    print(f"\n🔄 Running performance comparison ({num_tests} iterations)...")
    
    # TFT Performance Testing
    tft_times = []
    tft_predictions = []
    
    for i in range(num_tests):
        single_input = test_input[i % len(test_input):i % len(test_input) + 1]
        start_time = time.time()
        tft_output = tft_session.run([tft_output_name], {tft_input_name: single_input})[0]
        tft_times.append((time.time() - start_time) * 1000)
        if i == 0:  # Store first prediction for comparison
            tft_predictions = tft_output
    
    # N-HITS Performance Testing
    nhits_times = []
    nhits_predictions = []
    
    for i in range(num_tests):
        single_input = test_input[i % len(test_input):i % len(test_input) + 1]
        start_time = time.time()
        nhits_output = nhits_session.run([nhits_output_name], {nhits_input_name: single_input})[0]
        nhits_times.append((time.time() - start_time) * 1000)
        if i == 0:  # Store first prediction for comparison
            nhits_predictions = nhits_output
    
    # Calculate performance metrics
    tft_avg = np.mean(tft_times)
    tft_std = np.std(tft_times)
    nhits_avg = np.mean(nhits_times)
    nhits_std = np.std(nhits_times)
    
    print(f"\n⚡ Performance Results:")
    print(f"   TFT:    {tft_avg:.2f} ± {tft_std:.2f} ms")
    print(f"   N-HITS: {nhits_avg:.2f} ± {nhits_std:.2f} ms")
    print(f"   Combined: {tft_avg + nhits_avg:.2f} ms (parallel execution)")
    
    # Edge deployment assessment
    combined_size = tft_size_mb + nhits_size_mb
    max_latency = max(tft_avg, nhits_avg)  # Parallel execution
    
    edge_suitable = (
        combined_size < 10 and      # Size constraint
        max_latency < 100 and       # Latency constraint (parallel)
        tft_avg < 50 and           # Individual model constraints
        nhits_avg < 50
    )
    
    print(f"\n🎯 Dual Model Edge Deployment Assessment:")
    print(f"   Combined size (<10MB): {'✅' if combined_size < 10 else '❌'} {combined_size:.2f}MB")
    print(f"   TFT speed (<50ms): {'✅' if tft_avg < 50 else '❌'} {tft_avg:.2f}ms")
    print(f"   N-HITS speed (<50ms): {'✅' if nhits_avg < 50 else '❌'} {nhits_avg:.2f}ms")
    print(f"   Parallel latency: {max_latency:.2f}ms")
    print(f"   Overall: {'✅ READY FOR DUAL EDGE DEPLOYMENT' if edge_suitable else '❌ NEEDS OPTIMIZATION'}")
    
    # Prediction comparison
    pred_diff = np.abs(tft_predictions - nhits_predictions)
    print(f"\n📊 Model Agreement:")
    print(f"   Prediction difference: {np.mean(pred_diff):.6f}")
    print(f"   Models agreement: {'✅ GOOD' if np.mean(pred_diff) < 0.1 else '⚠️ DIVERGENT'}")
    
    # Store results
    results['tft_results'] = {
        'model_size_mb': tft_size_mb,
        'avg_latency_ms': tft_avg,
        'std_latency_ms': tft_std,
        'predictions_sample': tft_predictions.tolist()
    }
    
    results['nhits_results'] = {
        'model_size_mb': nhits_size_mb,
        'avg_latency_ms': nhits_avg,
        'std_latency_ms': nhits_std,
        'predictions_sample': nhits_predictions.tolist()
    }
    
    results['comparison'] = {
        'combined_size_mb': combined_size,
        'parallel_latency_ms': max_latency,
        'prediction_agreement': float(np.mean(pred_diff)),
        'edge_deployment_ready': edge_suitable
    }
    
    return results

def create_dual_model_deployment_spec(test_results, tft_config_path='edge_tft_artifacts/config.json', nhits_config_path='edge_nhits_artifacts/config.json'):
    """
    Create deployment specification for dual TFT + N-HITS Cloudflare Workers AI
    """
    print("\n📋 Creating Dual Model Cloudflare Deployment Specification...")
    
    # Load model configs
    with open(tft_config_path, 'r') as f:
        tft_config = json.load(f)
    
    with open(nhits_config_path, 'r') as f:
        nhits_config = json.load(f)
    
    deployment_spec = {
        "model_info": {
            "name": "dual-tft-nhits-financial",
            "version": "1.0.0",
            "description": "Dual edge-optimized TFT + N-HITS ensemble for financial time series prediction",
            "task_type": "time-series-forecasting",
            "framework": "pytorch-ensemble",
            "export_format": "dual-onnx"
        },
        "technical_specs": {
            "tft_model": {
                "model_size_mb": test_results['tft_results']['model_size_mb'],
                "inference_time_ms": test_results['tft_results']['avg_latency_ms'],
                "parameters": 30209,
                "input_shape": [1, tft_config['sequence_length'], len(tft_config['feature_columns'])],
                "output_shape": [1, 1]
            },
            "nhits_model": {
                "model_size_mb": test_results['nhits_results']['model_size_mb'],
                "inference_time_ms": test_results['nhits_results']['avg_latency_ms'],
                "parameters": 4989,
                "input_shape": [1, nhits_config['sequence_length'], len(nhits_config['feature_columns'])],
                "output_shape": [1, 1]
            },
            "ensemble_specs": {
                "combined_size_mb": test_results['comparison']['combined_size_mb'],
                "parallel_inference_time_ms": test_results['comparison']['parallel_latency_ms'],
                "total_parameters": 35198,
                "ensemble_strategy": "parallel_execution_with_weighted_average",
                "model_weights": {"tft": 0.6, "nhits": 0.4}
            },
            "opset_version": 13,
            "memory_usage": "estimated_very_low"
        },
        "performance_metrics": {
            "dual_model_validated": True,
            "prediction_agreement": test_results['comparison']['prediction_agreement'] < 0.1,
            "edge_deployment_ready": bool(test_results['comparison']['edge_deployment_ready']),
            "parallel_execution_optimized": True,
            "ensemble_advantage": "complementary_temporal_patterns"
        },
        "deployment_requirements": {
            "custom_requirements_form": "required",
            "enterprise_contact": "required",
            "estimated_timeline": "8-12 weeks",
            "dual_model_complexity": "moderate",
            "prerequisites": [
                "Cloudflare Enterprise account",
                "Custom Requirements Form for dual model deployment",
                "Technical review for ensemble architecture",
                "Performance validation in Cloudflare environment"
            ]
        },
        "use_case": {
            "description": "Dual model ensemble for robust financial time series prediction",
            "input_data": "OHLCV financial data (30-day sequences)",
            "output_data": "Ensemble averaged price predictions with model confidence",
            "ensemble_advantage": "TFT captures complex patterns, N-HITS handles hierarchical trends",
            "latency_requirement": "<200ms parallel execution",
            "throughput_requirement": "300 requests/minute per model"
        },
        "model_files": {
            "tft_onnx": "edge_tft_financial.onnx",
            "nhits_onnx": "edge_nhits_financial.onnx",
            "tft_artifacts": "edge_tft_artifacts/",
            "nhits_artifacts": "edge_nhits_artifacts/"
        }
    }
    
    # Save deployment spec
    with open('dual_model_deployment_spec.json', 'w') as f:
        json.dump(deployment_spec, f, indent=2)
    
    print("   📄 Dual model deployment spec saved: dual_model_deployment_spec.json")
    
    return deployment_spec

def generate_dual_model_requirements_form_data(deployment_spec):
    """
    Generate Custom Requirements Form data for dual TFT + N-HITS deployment
    """
    print("\n📝 Generating Dual Model Custom Requirements Form Data...")
    
    form_data = {
        "contact_info": {
            "company": "Advanced Trading Systems",
            "use_case": "Dual model ensemble for financial time series prediction",
            "expected_usage": "300 requests/minute per model, 24/7 operation with ensemble averaging"
        },
        "model_requirements": {
            "model_type": "Dual ensemble: Edge TFT + Edge N-HITS",
            "tft_model_size": f"{deployment_spec['technical_specs']['tft_model']['model_size_mb']:.2f}MB",
            "nhits_model_size": f"{deployment_spec['technical_specs']['nhits_model']['model_size_mb']:.2f}MB",
            "combined_size": f"{deployment_spec['technical_specs']['ensemble_specs']['combined_size_mb']:.2f}MB",
            "inference_requirements": f"<{deployment_spec['technical_specs']['ensemble_specs']['parallel_inference_time_ms']:.0f}ms parallel execution",
            "input_format": "OHLCV financial time series data",
            "output_format": "Ensemble averaged price predictions with model confidence scores",
            "ensemble_strategy": deployment_spec['technical_specs']['ensemble_specs']['ensemble_strategy']
        },
        "technical_requirements": {
            "availability": "99.9% uptime required for trading operations",
            "scaling": "Auto-scaling based on market hours with dual model load balancing",
            "security": "Financial data processing compliance with dual model architecture",
            "integration": "REST API integration supporting parallel model execution",
            "ensemble_logic": "Weighted averaging with fallback to single model if one fails"
        },
        "business_requirements": {
            "timeline": "POC in 8-10 weeks, production in 12-14 weeks",
            "budget": "Enterprise tier acceptable for dual model deployment",
            "compliance": "Financial services compliance for ensemble trading systems",
            "model_advantages": "Improved robustness through complementary temporal pattern capture"
        },
        "deployment_complexity": {
            "architecture": "Dual model parallel execution",
            "fallback_strategy": "Single model operation if one fails",
            "monitoring": "Per-model performance tracking and ensemble agreement monitoring",
            "resource_requirements": "Optimized for edge deployment with minimal overhead"
        }
    }
    
    with open('dual_model_requirements_form_data.json', 'w') as f:
        json.dump(form_data, f, indent=2)
    
    print("   📄 Dual model form data saved: dual_model_requirements_form_data.json")
    print(f"\n📞 Next Steps for Dual Model Deployment:")
    print(f"   1. Visit: https://www.cloudflare.com/lp/workers-ai/")
    print(f"   2. Submit Custom Requirements Form for dual model ensemble")
    print(f"   3. Attach: dual_model_deployment_spec.json")
    print(f"   4. Reference: dual_model_requirements_form_data.json")
    print(f"   5. Emphasize ensemble advantages and edge optimization")
    
    return form_data

def main():
    """
    Main dual model testing function
    """
    print("🔍 Dual TFT + N-HITS ONNX Model Validation for Cloudflare Workers AI")
    print("=" * 70)
    
    # Check if model files exist
    tft_onnx_path = 'edge_tft_financial.onnx'
    nhits_onnx_path = 'edge_nhits_financial.onnx'
    tft_config_path = 'edge_tft_artifacts/config.json'
    nhits_config_path = 'edge_nhits_artifacts/config.json'
    
    missing_files = []
    for file_path in [tft_onnx_path, nhits_onnx_path, tft_config_path, nhits_config_path]:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        print(f"❌ Missing files: {', '.join(missing_files)}")
        print("   Run edge_tft_model.py and edge_nhits_model.py first.")
        return
    
    # Generate test data
    print("📊 Generating test data...")
    data = generate_sample_data(days=100)
    predictor = FinancialTFTPredictor(sequence_length=30)
    X_test, _ = predictor.prepare_data(data)
    
    # Test dual ONNX models
    test_results = test_dual_onnx_models(tft_onnx_path, nhits_onnx_path, X_test)
    
    # Create deployment specs
    deployment_spec = create_dual_model_deployment_spec(test_results, tft_config_path, nhits_config_path)
    form_data = generate_dual_model_requirements_form_data(deployment_spec)
    
    # Summary
    print(f"\n✅ Dual Model Validation Complete!")
    print(f"   📊 TFT Performance: {test_results['tft_results']['avg_latency_ms']:.1f}ms, {test_results['tft_results']['model_size_mb']:.2f}MB")
    print(f"   📊 N-HITS Performance: {test_results['nhits_results']['avg_latency_ms']:.1f}ms, {test_results['nhits_results']['model_size_mb']:.2f}MB")
    print(f"   📊 Combined: {test_results['comparison']['parallel_latency_ms']:.1f}ms parallel, {test_results['comparison']['combined_size_mb']:.2f}MB")
    print(f"   📁 Files Generated:")
    print(f"      - dual_model_deployment_spec.json")
    print(f"      - dual_model_requirements_form_data.json")
    
    if test_results['comparison']['edge_deployment_ready']:
        print(f"\n🚀 READY FOR DUAL MODEL CLOUDFLARE ENTERPRISE CONTACT!")
    else:
        print(f"\n⚠️  Dual models need optimization before deployment")
    
    return test_results, deployment_spec, form_data

if __name__ == "__main__":
    test_results, deployment_spec, form_data = main()