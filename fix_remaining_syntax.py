#!/usr/bin/env python3
"""
Fix remaining syntax errors in TypeScript files
"""

import re
import os
import glob

def fix_remaining_syntax_errors(file_path):
    """Fix remaining syntax errors in a TypeScript file"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix malformed type guards in filter functions
        # pattern: (param): type is Type: any => condition
        content = re.sub(r'\(([^)]+)\):\s*([^)]+)\s*is\s*(\w+):\s*any\s*=>\s*([^)]*)\)', r'(\1): \2 is \3 => \4', content)

        # Fix malformed array filter with type guards
        # pattern: filter((item): item is Type: any => condition)
        content = re.sub(r'\.filter\(\(([^)]+)\):\s*([^)]+)\s*is\s*(\w+):\s*any\s*=>\s*([^)]*)\)\)', r'.filter((\1): \2 is \3 => \4)', content)

        # Fix malformed object property access with type annotations
        # pattern: obj.prop: Type = value
        content = re.sub(r'(\w+\.\w+):\s*(\w+(?:<[^>]*>)?)\s*=\s*([^,;}\n]+)', r'\1 = \3', content)

        # Fix malformed object property definitions
        # pattern: prop: Type: Type = value
        content = re.sub(r'(\w+):\s*(\w+(?:<[^>]*>)?):\s*(\w+(?:<[^>]*>)?)\s*=\s*([^,;}\n]+)', r'\1: \2 = \4', content)

        # Fix malformed function parameter type annotations
        # pattern: param: Type: Type
        content = re.sub(r'(\w+):\s*(\w+(?:<[^>]*>)?):\s*(\w+(?:<[^>]*>)?)(?=[,)])', r'\1: \2', content)

        # Fix malformed array access with type annotations
        # pattern: array[index]: Type
        content = re.sub(r'(\w+\[[^\]]+\]):\s*(\w+(?:<[^>]*>)?)(?=[\s,.)}\]])', r'\1', content)

        # Fix malformed method calls with type annotations
        # pattern: method(param): Type
        content = re.sub(r'(\w+\([^)]*\)):\s*(\w+(?:<[^>]*>)?)(?=[\s,.)}\]])', r'\1', content)

        # Write the fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        changes_made = content != original_content
        return changes_made

    except Exception as e:
        print(f"Error fixing file {file_path}: {e}")
        return False

def fix_all_remaining_errors():
    """Find and fix remaining syntax errors in all TypeScript files"""

    # Focus on files that still have errors
    ts_files = glob.glob('src/**/*.ts', recursive=True)

    fixed_files = []

    for file_path in ts_files:
        if fix_remaining_syntax_errors(file_path):
            fixed_files.append(file_path)
            print(f"✅ Fixed remaining errors: {file_path}")

    print(f"\n📊 Summary:")
    print(f"  Files fixed: {len(fixed_files)}")

    return len(fixed_files)

if __name__ == "__main__":
    print("🔧 Fixing remaining syntax errors in TypeScript files...")
    fixed_count = fix_all_remaining_errors()

    if fixed_count > 0:
        print(f"\n🎉 Successfully fixed remaining errors in {fixed_count} TypeScript files!")
    else:
        print("\n✅ No remaining syntax errors found")