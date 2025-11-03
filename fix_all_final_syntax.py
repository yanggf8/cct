#!/usr/bin/env python3
"""
Final comprehensive syntax error fix for all TypeScript files
"""

import re
import os
import glob

def fix_all_final_syntax(file_path):
    """Final comprehensive syntax error fix for a TypeScript file"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix malformed arrow function in map
        # pattern: array.map(param) => expression)
        content = re.sub(r'\.map\(([^)]+)\)\s*=>\s*([^)]*)\)', r'.map(\1 => \2)', content)

        # Fix malformed function call parameters
        # pattern: function(param: any)
        content = re.sub(r'(\w+)\(([^)]*):\s*any\s*\)', r'\1(\2)', content)

        # Fix malformed logger.info calls
        # pattern: logger.info(('message', {obj}))
        content = re.sub(r'logger\.info\(\(\s*\'([^\']+)\',\s*({[^}]+})\s*\)\)', r"logger.info('\1', \2)", content)

        # Fix malformed array methods
        # pattern: array.method(param) => expression)
        content = re.sub(r'\.(\w+)\(([^)]+)\)\s*=>\s*([^)]*)\)', r'.\1(\2 => \3)', content)

        # Fix malformed function signatures
        # pattern: function(param): Type1 Type2
        content = re.sub(r'(\w+\([^)]*\))\s*:\s*([A-Z_]+)\s+([A-Z_]+)', r'\1: \2', content)

        # Fix malformed type annotations in object literals
        # pattern: { prop: Type: any }
        content = re.sub(r'(\{\s*\w+):\s*([^:]+):\s*any\s*:', r'{ \1: \2:', content)

        # Fix malformed array.map calls
        # pattern: array.map(param) => condition)
        content = re.sub(r'\.map\(([^)]+)\)\s*=>\s*([^)]*)\)', r'.map(\1 => \2)', content)

        # Fix malformed Promise.all calls
        # pattern: Promise.all((...array))
        content = re.sub(r'Promise\.all\(\(\.\.\.([^)]+)\)\)', r'Promise.all(...\1)', content)

        # Fix malformed Math functions
        # pattern: Math.func((...array))
        content = re.sub(r'Math\.(\w+)\(\(\.\.\.([^)]+)\)\)', r'Math.\1(...\2)', content)

        # Fix malformed ternary operators
        # pattern: condition ? expr1: any : expr2: any
        content = re.sub(r'\?\s*([^:]+):\s*any\s*:\s*([^:]+):\s*any', r'? \1 : \2', content)

        # Fix malformed function parameters with type annotations
        # pattern: (param: Type: any)
        content = re.sub(r'\(([^)]*):\s*([^:]+):\s*any\s*\)', r'(\1: \2)', content)

        # Fix malformed return type annotations
        # pattern: ): Type: any {
        content = re.sub(r'\)\s*:\s*([^:]+):\s*any\s*{', r'): \1 {', content)

        # Write the fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        changes_made = content != original_content
        return changes_made

    except Exception as e:
        print(f"Error fixing file {file_path}: {e}")
        return False

def fix_all_files_final():
    """Fix all TypeScript files with final syntax corrections"""

    # Find all TypeScript files
    ts_files = glob.glob('src/**/*.ts', recursive=True)

    fixed_files = []

    for file_path in ts_files:
        if fix_all_final_syntax(file_path):
            fixed_files.append(file_path)
            print(f"✅ Fixed final syntax: {file_path}")

    print(f"\n📊 Summary:")
    print(f"  Files fixed: {len(fixed_files)}")

    return len(fixed_files)

if __name__ == "__main__":
    print("🔧 Fixing final syntax errors in all TypeScript files...")
    fixed_count = fix_all_files_final()

    if fixed_count > 0:
        print(f"\n🎉 Successfully fixed final syntax errors in {fixed_count} TypeScript files!")
    else:
        print("\n✅ No final syntax errors found")