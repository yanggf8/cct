#!/usr/bin/env python3
"""
Install TFT (Temporal Fusion Transformer) requirements
Handles pytorch-forecasting and dependencies installation
"""

import subprocess
import sys
import os
from datetime import datetime

def install_package(package_name: str, version: str = None) -> bool:
    """Install a package with pip"""
    
    try:
        if version:
            package_spec = f"{package_name}=={version}"
        else:
            package_spec = package_name
            
        print(f"📦 Installing {package_spec}...")
        
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", package_spec],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            print(f"✅ Successfully installed {package_spec}")
            return True
        else:
            print(f"❌ Failed to install {package_spec}")
            print(f"Error: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"⏰ Installation timeout for {package_spec}")
        return False
    except Exception as e:
        print(f"❌ Error installing {package_spec}: {e}")
        return False

def check_cuda_availability():
    """Check if CUDA is available for PyTorch"""
    
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        print(f"🔥 CUDA available: {cuda_available}")
        if cuda_available:
            print(f"   GPU count: {torch.cuda.device_count()}")
            print(f"   Current device: {torch.cuda.get_device_name()}")
        return cuda_available
    except ImportError:
        print("❌ PyTorch not available")
        return False

def install_tft_dependencies():
    """Install all TFT dependencies in order"""
    
    print("🚀 Installing TFT (Temporal Fusion Transformer) Dependencies")
    print("=" * 70)
    print(f"Started at: {datetime.now()}")
    
    # Core dependencies first
    core_packages = [
        ("torch", "2.1.0"),
        ("pytorch-lightning", "2.1.0"),
        ("scikit-learn", "1.3.0"),
        ("pandas", "2.1.0"),
        ("numpy", "1.24.0"),
    ]
    
    # Advanced packages
    advanced_packages = [
        ("pytorch-forecasting", None),  # Latest version
        ("optuna", "3.4.0"),
        ("matplotlib", "3.7.0"),
        ("seaborn", "0.12.0"),
    ]
    
    success_count = 0
    total_packages = len(core_packages) + len(advanced_packages)
    
    # Install core packages
    print("\n📋 Installing Core Packages:")
    print("-" * 40)
    
    for package, version in core_packages:
        if install_package(package, version):
            success_count += 1
    
    # Check PyTorch installation
    cuda_available = check_cuda_availability()
    
    # Install advanced packages
    print("\n📋 Installing Advanced Packages:")
    print("-" * 40)
    
    for package, version in advanced_packages:
        if install_package(package, version):
            success_count += 1
    
    # Installation summary
    print(f"\n📊 Installation Summary:")
    print("=" * 40)
    print(f"✅ Successful: {success_count}/{total_packages}")
    print(f"❌ Failed: {total_packages - success_count}/{total_packages}")
    print(f"🔥 CUDA Support: {'Yes' if cuda_available else 'No'}")
    
    # Test imports
    print(f"\n🧪 Testing Critical Imports:")
    print("-" * 30)
    
    test_imports = [
        ("torch", "PyTorch"),
        ("pytorch_lightning", "PyTorch Lightning"),
        ("pytorch_forecasting", "PyTorch Forecasting"),
        ("sklearn", "Scikit-learn"),
        ("pandas", "Pandas"),
        ("numpy", "NumPy"),
    ]
    
    working_imports = 0
    for module, name in test_imports:
        try:
            __import__(module)
            print(f"✅ {name}")
            working_imports += 1
        except ImportError:
            print(f"❌ {name}")
    
    print(f"\n🎯 Final Status:")
    if working_imports == len(test_imports):
        print("🟢 TFT environment ready for training!")
        return True
    elif working_imports >= 4:  # Core packages working
        print("🟡 Partial TFT environment - fallback mode available")
        return False
    else:
        print("🔴 TFT environment setup failed - using N-HITS only")
        return False

def create_lightweight_requirements():
    """Create minimal requirements file for TFT"""
    
    requirements = """# TFT (Temporal Fusion Transformer) Requirements
# Core ML packages
torch>=2.0.0
pytorch-lightning>=2.0.0
pytorch-forecasting>=1.0.0

# Data processing
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0

# Optimization
optuna>=3.0.0

# Visualization (optional)
matplotlib>=3.7.0
seaborn>=0.12.0

# Market data
yfinance>=0.2.0
"""
    
    with open('tft_requirements.txt', 'w') as f:
        f.write(requirements)
    
    print(f"📄 Created tft_requirements.txt")
    return 'tft_requirements.txt'

def main():
    """Main installation function"""
    
    # Create requirements file
    req_file = create_lightweight_requirements()
    
    # Check current environment
    print("🔍 Checking current environment...")
    
    try:
        import torch
        print(f"✅ PyTorch already available: {torch.__version__}")
    except ImportError:
        print("❌ PyTorch not found")
    
    try:
        import pytorch_forecasting
        print(f"✅ PyTorch Forecasting already available")
        return True
    except ImportError:
        print("❌ PyTorch Forecasting not found")
    
    # Proceed with installation
    success = install_tft_dependencies()
    
    if success:
        print("\n🎉 TFT environment setup complete!")
        print("Next steps:")
        print("1. Run TFT training with: python tft_implementation.py")
        print("2. Compare TFT vs N-HITS performance")
        print("3. Deploy best model to production")
    else:
        print("\n⚠️ TFT environment setup incomplete")
        print("Fallback available:")
        print("1. N-HITS model will be used as backup")
        print("2. Basic TFT implementation may work")
        print("3. Manual installation: pip install -r tft_requirements.txt")
    
    return success

if __name__ == "__main__":
    success = main()