#!/usr/bin/env python3
"""
Fix syntax errors across all TypeScript files
"""

import re
import os
import glob

def fix_file_syntax_errors(file_path):
    """Fix syntax errors in a TypeScript file"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix malformed arrow function type annotations
        # pattern: (param: any => result)
        content = re.sub(r'\(([^)]*):\s*any\s*=>\s*([^)]+)\)', r'((\1): any => \2)', content)

        # Fix malformed type annotations in object properties
        # pattern: propertyName: any: any
        content = re.sub(r'(\w+):\s*any:\s*any', r'\1: any', content)

        # Fix malformed type annotations in variable access
        # pattern: variable.property: any
        content = re.sub(r'(\w+\.\w+):\s*any', r'\1', content)

        # Fix malformed type annotations in arithmetic expressions
        # pattern: expression: any
        content = re.sub(r'([a-zA-Z0-9_.()+\-*/\s]+):\s*any(?=[,})\]])', r'\1', content)

        # Fix malformed type annotations in method calls
        # pattern: method(param: any, param2: any): any
        content = re.sub(r'(\w+\([^)]*):\s*any(?=\))', r'\1', content)

        # Fix malformed string methods
        # pattern: toString(36: any).substr(2: any, 9: any)
        content = re.sub(r'toString\((\d+):\s*any\)\.substr\((\d+):\s*any,\s*(\d+):\s*any\)', r'toString(\1).substr(\2, \3)', content)

        # Fix malformed JSON.stringify parameters
        # pattern: JSON.stringify(obj, null: any, 2: any)
        content = re.sub(r'JSON\.stringify\(([^,]+),\s*null:\s*any,\s*(\d+):\s*any\)', r'JSON.stringify(\1, null, \2)', content)

        # Fix malformed error annotations
        # pattern: catch (error: any: any)
        content = re.sub(r'catch\s*\(\s*(\w+):\s*any:\s*any\s*\)', r'catch (\1: any)', content)

        # Fix malformed type annotations in conditional
        # pattern: if (variable: any)
        content = re.sub(r'if\s*\(\s*([^)]+):\s*any\s*\)', r'if (\1)', content)

        # Fix malformed type annotations in array access
        # pattern: array[index: any]
        content = re.sub(r'(\w+\[[^\]]+):\s*any(?=\])', r'\1', content)

        # Fix malformed type annotations in object property access
        # pattern: obj?.prop: any
        content = re.sub(r'(\w+\??\.\w+):\s*any', r'\1', content)

        # Fix malformed type annotations in expressions
        # pattern: expression + expression: any
        content = re.sub(r'([a-zA-Z0-9_.()+\-*/\s]+):\s*any(?=[+\-*/})\],;])', r'\1', content)

        # Additional fixes for malformed type annotations
        content = re.sub(r':\s*any(?=\s*[,})\]])', '', content)

        # Fix malformed generic type annotations
        # pattern: Type<any: any>
        content = re.sub(r'<([^<>]+):\s*any\s*>', r'<\1>', content)

        # Fix malformed Promise type annotations
        # pattern: Promise<Type: any>
        content = re.sub(r'Promise<([^>]+):\s*any\s*>', r'Promise<\1>', content)

        # Write the fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        changes_made = content != original_content
        return changes_made

    except Exception as e:
        print(f"Error fixing file {file_path}: {e}")
        return False

def fix_all_typeScript_files():
    """Find and fix syntax errors in all TypeScript files"""

    # Find all TypeScript files
    ts_files = glob.glob('src/**/*.ts', recursive=True)

    fixed_files = []
    error_files = []

    for file_path in ts_files:
        if fix_file_syntax_errors(file_path):
            fixed_files.append(file_path)
            print(f"✅ Fixed: {file_path}")

    print(f"\n📊 Summary:")
    print(f"  Files fixed: {len(fixed_files)}")
    print(f"  Files with errors: {len(error_files)}")

    return len(fixed_files)

if __name__ == "__main__":
    print("🔧 Fixing syntax errors in all TypeScript files...")
    fixed_count = fix_all_typeScript_files()

    if fixed_count > 0:
        print(f"\n🎉 Successfully fixed {fixed_count} TypeScript files!")
    else:
        print("\n✅ No syntax errors found or all files already fixed")