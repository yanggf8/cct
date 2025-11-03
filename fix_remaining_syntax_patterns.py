#!/usr/bin/env python3
"""
Fix remaining syntax error patterns in TypeScript files
"""

import re
import os
import glob

def fix_remaining_syntax_patterns(file_path):
    """Fix remaining syntax patterns in a TypeScript file"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix malformed array spread syntax
        # pattern: Math.max((...array.map(...)))
        content = re.sub(r'Math\.max\(\(\.\.\.([^)]+)\.map\(([^)]+)\)\)\)', r'Math.max(...\1.map(\2))', content)

        # Fix malformed Math.max with array spread
        # pattern: Math.max((...array))
        content = re.sub(r'Math\.max\(\(\.\.\.([^)]+)\)\)', r'Math.max(...\1)', content)

        # Fix malformed Math.min with array spread
        # pattern: Math.min((...array))
        content = re.sub(r'Math\.min\(\(\.\.\.([^)]+)\)\)', r'Math.min(...\1)', content)

        # Fix malformed function calls with extra parentheses
        # pattern: function((param))
        content = re.sub(r'(\w+)\(\(([^)]+)\)\)', r'\1(\2)', content)

        # Fix malformed object property access
        # pattern: obj.prop: any = value
        content = re.sub(r'(\w+\.\w+):\s*any\s*=', r'\1 =', content)

        # Write the fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        changes_made = content != original_content
        return changes_made

    except Exception as e:
        print(f"Error fixing file {file_path}: {e}")
        return False

def fix_all_remaining_patterns():
    """Find and fix remaining syntax patterns in all TypeScript files"""

    # Find all TypeScript files
    ts_files = glob.glob('src/**/*.ts', recursive=True)

    fixed_files = []

    for file_path in ts_files:
        if fix_remaining_syntax_patterns(file_path):
            fixed_files.append(file_path)
            print(f"✅ Fixed remaining patterns: {file_path}")

    print(f"\n📊 Summary:")
    print(f"  Files fixed: {len(fixed_files)}")

    return len(fixed_files)

if __name__ == "__main__":
    print("🔧 Fixing remaining syntax patterns in TypeScript files...")
    fixed_count = fix_all_remaining_patterns()

    if fixed_count > 0:
        print(f"\n🎉 Successfully fixed remaining patterns in {fixed_count} TypeScript files!")
    else:
        print("\n✅ No remaining syntax patterns found")