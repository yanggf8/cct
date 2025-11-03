#!/usr/bin/env python3
"""
Automated fixer for TypeScript TS7006 errors (Parameter implicitly has an 'any' type)
This script adds explicit 'any' type annotations to function parameters that lack type annotations.
"""

import re
import os
from pathlib import Path


def fix_ts7006_in_file(file_path: str) -> int:
    """
    Fix TS7006 errors in a single file by adding explicit 'any' types to parameters.
    Returns the number of fixes applied.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        original_content = f.read()
    
    # Pattern to match function parameters without type annotations
    # This regex handles common patterns where parameters are implicitly 'any'
    patterns = [
        # Arrow function parameters
        (r'\b(\w+)\s*(?=\s*=>\s*\w)', r'\1: any'),
        # Regular function parameters in various contexts
        (r'\b(\w+)\s*(?=\s*,)', r'\1: any'),
        (r'\b(\w+)\s*(?=\s*\))', r'\1: any'),
        # Parameters in array method callbacks
        (r'(\.map\(|\.filter\(|\.forEach\(|\.reduce\(|\.find\(|\.findIndex\(|\.some\(|\.every\(|\.sort\(|\.flatMap\()(\w+)(\s*=>)', r'\1\2: any\3'),
    ]
    
    fixed_content = original_content
    fixes_count = 0
    
    for pattern, replacement in patterns:
        try:
            new_content = re.sub(pattern, replacement, fixed_content)
            if new_content != fixed_content:
                fixes_count += (new_content.count(': any') - fixed_content.count(': any'))
                fixed_content = new_content
        except re.error as e:
            print(f"Regex error for pattern {pattern} in {file_path}: {e}")
            continue
    
    # More specific patterns for common callback parameters in array methods
    # This looks for common array methods with implicit parameters
    callback_patterns = [
        # More precise pattern for single parameter callbacks
        (r'(\.map\s*\(\s*)(\w+)\s*(\s*=>)', r'\1\2: any\3'),
        (r'(\.filter\s*\(\s*)(\w+)\s*(\s*=>)', r'\1\2: any\3'),
        (r'(\.forEach\s*\(\s*)(\w+)\s*(\s*=>)', r'\1\2: any\3'),
        (r'(\.find\s*\(\s*)(\w+)\s*(\s*=>)', r'\1\2: any\3'),
        (r'(\.some\s*\(\s*)(\w+)\s*(\s*=>)', r'\1\2: any\3'),
        (r'(\.every\s*\(\s*)(\w+)\s*(\s*=>)', r'\1\2: any\3'),
    ]
    
    for pattern, replacement in callback_patterns:
        try:
            new_content = re.sub(pattern, replacement, fixed_content)
            if new_content != fixed_content:
                additional_fixes = (new_content.count(': any') - fixed_content.count(': any'))
                fixes_count += additional_fixes
                fixed_content = new_content
        except re.error as e:
            print(f"Regex error for callback pattern {pattern} in {file_path}: {e}")
            continue

    # For explicit parameter lists that need 'any' type
    # Look for function declarations with parameter names but no types
    param_pattern = r'(function\s+\w+\s*\(\s*|\(\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*[,\)])'
    # First, make sure we don't match already typed parameters
    for match in re.finditer(param_pattern, fixed_content):
        param_name = match.group(2)
        full_match = match.group(0)
        # Check if this parameter already has a type annotation
        if ':' not in full_match:
            # Replace the parameter with an explicit any type
            new_param = f"{param_name}: any{match.group(3)}"
            fixed_content = fixed_content.replace(full_match, full_match.replace(f"{param_name}{match.group(3)}", new_param))
            fixes_count += 1
    
    if original_content != fixed_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"Applied {fixes_count} fixes for TS7006 in {file_path}")
        return fixes_count
    
    return 0


def find_ts_files(root_dir: str) -> list:
    """Find all TypeScript files in the given directory."""
    ts_files = []
    for root, dirs, files in os.walk(root_dir):
        # Skip node_modules and other common non-source directories
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '.vscode', 'dist', 'build']]
        for file in files:
            if file.endswith('.ts'):
                ts_files.append(os.path.join(root, file))
    return ts_files


def main():
    print("Starting automated fixing of TS7006 (Parameter implicitly has an 'any' type) errors...")
    
    root_dir = '/home/yanggf/a/cct'
    ts_files = find_ts_files(root_dir)
    
    total_fixes = 0
    files_fixed = 0
    
    for ts_file in ts_files:
        try:
            fixes = fix_ts7006_in_file(ts_file)
            if fixes > 0:
                total_fixes += fixes
                files_fixed += 1
        except Exception as e:
            print(f"Error processing {ts_file}: {e}")
    
    print(f"\nCompleted fixing TS7006 errors!")
    print(f"Files processed: {files_fixed}")
    print(f"Total fixes applied: {total_fixes}")


if __name__ == "__main__":
    main()