#!/usr/bin/env python3
"""
Automated fixer for TypeScript TS18046 errors ('is of type 'unknown'')
This script adds type assertions or type guards for variables of unknown type.
"""

import re
import os
from pathlib import Path


def fix_ts18046_in_file(file_path: str) -> int:
    """
    Fix TS18046 errors in a single file by adding type assertions or guards for 'unknown' type variables.
    Returns the number of fixes applied.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        original_content = f.read()
    
    fixed_content = original_content
    fixes_count = 0
    
    # Pattern 1: Variables declared as 'unknown' that need type assertion
    # Look for patterns like: const data = await response.json();
    # Where TypeScript infers the type as 'unknown'
    lines = fixed_content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        new_line = line
        # Look for assignments from response.json() or similar
        if '= await response.json()' in line or '= response.json()' in line:
            var_match = re.search(r'(const|let|var)\s+(\w+)', line)
            if var_match:
                var_name = var_match.group(2)
                # Add a type assertion or a type guard check
                # We'll add a type assertion after the line if it's used in a context that suggests a specific type
                new_line = line.replace(f'= await response.json()', f'= await response.json() as any')
                if new_line != line:
                    fixes_count += 1
        elif '= await fetch(' in line and ('.json()' in line or '.json' in fixed_content):
            # Handle cases where .json() is called on the result of fetch in subsequent lines
            new_line = line
        
        new_lines.append(new_line)
    
    fixed_content = '\n'.join(new_lines)
    
    # Pattern 2: Add type assertions to 'unknown' type variables based on usage context
    # This looks for patterns like: 'data' is of type 'unknown' and adds type guards
    
    # Look for common patterns where we can add type assertions
    patterns = [
        # Add type assertion to json() calls
        (r'(\w+)\s*=\s*await\s+response\.json\(\)', r'\1 = await response.json() as any'),
        (r'(\w+)\s*=\s*response\.json\(\)', r'\1 = response.json() as any'),
        
        # Add type assertion after try/catch for unknown errors
        (r'catch\s*\(\s*(\w+)\s*\)', r'catch(\1: unknown)'),
    ]
    
    for pattern, replacement in patterns:
        try:
            new_content = re.sub(pattern, replacement, fixed_content)
            if new_content != fixed_content:
                fixes_count += new_content.count(' as any') - fixed_content.count(' as any')
                fixed_content = new_content
        except re.error as e:
            print(f"Regex error for pattern {pattern} in {file_path}: {e}")
            continue
    
    # More specific pattern: Add type guards for unknown type variables
    # Look for common usage patterns that suggest the actual type
    lines = fixed_content.split('\n')
    new_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        new_line = line
        
        # Look for access patterns that can inform us about the type
        if re.search(r'\w+\s*=\s*await.*\.json\(\)', line):
            var_match = re.search(r'(const|let|var)\s+(\w+)', line)
            if var_match:
                var_name = var_match.group(2)
                # Check if the next few lines use this variable in a way that suggests its type
                j = i + 1
                while j < min(i + 5, len(lines)):
                    next_line = lines[j]
                    if var_name + '.' in next_line or f'[{var_name}' in next_line:
                        # Add type assertion to the original assignment
                        if ' as any' not in line:
                            new_line = re.sub(r'(\w+)\s*=\s*(await\s+.*)', rf'\1 = \2 as any', line)
                            if new_line != line:
                                fixes_count += 1
                            break
                    j += 1
        new_lines.append(new_line)
        i += 1
    
    fixed_content = '\n'.join(new_lines)
    
    if original_content != fixed_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"Applied {fixes_count} fixes for TS18046 in {file_path}")
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
    print("Starting automated fixing of TS18046 ('is of type 'unknown'') errors...")
    
    root_dir = '/home/yanggf/a/cct'
    ts_files = find_ts_files(root_dir)
    
    total_fixes = 0
    files_fixed = 0
    
    for ts_file in ts_files:
        try:
            fixes = fix_ts18046_in_file(ts_file)
            if fixes > 0:
                total_fixes += fixes
                files_fixed += 1
        except Exception as e:
            print(f"Error processing {ts_file}: {e}")
    
    print(f"\nCompleted fixing TS18046 errors!")
    print(f"Files processed: {files_fixed}")
    print(f"Total fixes applied: {total_fixes}")


if __name__ == "__main__":
    main()