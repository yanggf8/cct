#!/usr/bin/env python3
"""
Fix specific syntax errors in TypeScript files
"""

import re
import os
import glob

def fix_specific_syntax_errors(file_path):
    """Fix specific syntax errors in a TypeScript file"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix malformed type guard in filter
        # pattern: (cat) is R is kCategory =>
        content = re.sub(r'\((\w+)\)\s*is\s*R\s*is\s*kCategory\s*=>', r'(\1): cat is RiskCategory =>', content)

        # Fix malformed return type annotation
        # pattern: method(param): TYPE1 TYPE2
        content = re.sub(r'(\w+\([^)]*\))\s*([A-Z_]+)\s*([A-Z_]+)', r'\1: \2', content)

        # Fix malformed type annotations in general
        # pattern: ): Type1 Type2 {
        content = re.sub(r'\)\s*:\s*([A-Z_]+)\s*([A-Z_]+)\s*{', r'): \1 {', content)

        # Write the fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        changes_made = content != original_content
        return changes_made

    except Exception as e:
        print(f"Error fixing file {file_path}: {e}")
        return False

def fix_specific_files():
    """Fix specific files that have syntax errors"""

    # Focus on files with known syntax errors
    files_to_fix = [
        'src/modules/advanced-risk-management.ts',
    ]

    fixed_files = []

    for file_path in files_to_fix:
        if os.path.exists(file_path):
            if fix_specific_syntax_errors(file_path):
                fixed_files.append(file_path)
                print(f"✅ Fixed specific errors: {file_path}")
        else:
            print(f"❌ File not found: {file_path}")

    print(f"\n📊 Summary:")
    print(f"  Files fixed: {len(fixed_files)}")

    return len(fixed_files)

if __name__ == "__main__":
    print("🔧 Fixing specific syntax errors...")
    fixed_count = fix_specific_files()

    if fixed_count > 0:
        print(f"\n🎉 Successfully fixed specific errors in {fixed_count} files!")
    else:
        print("\n✅ No specific syntax errors found")