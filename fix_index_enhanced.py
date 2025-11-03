#!/usr/bin/env python3
"""
Fix syntax errors in index-enhanced.ts file
"""

import re
import sys

def fix_syntax_errors(file_path):
    """Fix common syntax errors in the TypeScript file"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

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

        # Fix malformed type annotations in string methods
        # pattern: toString(36: any)
        content = re.sub(r'(\w+\([^)]*):\s*any(?=\))', r'\1', content)

        # Fix malformed JSON.stringify parameters
        # pattern: JSON.stringify(obj, null: any, 2: any)
        content = re.sub(r'JSON\.serialize\(([^,]+),\s*null:\s*any,\s*(\d+):\s*any\)', r'JSON.stringify(\1, null, \2)', content)

        # Fix malformed error annotations
        # pattern: catch (error: any: any)
        content = re.sub(r'catch\s*\(\s*(\w+):\s*any:\s*any\s*\)', r'catch (\1: any)', content)

        # Fix malformed type annotations in conditional
        # pattern: if (variable: any)
        content = re.sub(r'if\s*\(\s*([^)]+):\s*any\s*\)', r'if (\1)', content)

        # Fix malformed type annotations in ternary
        # pattern: condition ? value1: any : value2: any
        content = re.sub(r'([?:]\s*)[^,}\s]+:\s*any', lambda m: m.group(0).replace(': any', ''), content)

        # Fix malformed type annotations in array access
        # pattern: array[index: any]
        content = re.sub(r'(\w+\[[^\]]+):\s*any(?=\])', r'\1', content)

        # Fix malformed arrow function type annotations
        # pattern: (param: any => result)
        content = re.sub(r'\(([^)]+):\s*any\s*=>\s*([^)]+)\)', r'((\1): any => \2)', content)

        # Fix malformed type annotations in object property access
        # pattern: obj?.prop: any
        content = re.sub(r'(\w+\??\.\w+):\s*any', r'\1', content)

        # Fix malformed type annotations in expressions with operators
        # pattern: expression + expression: any
        content = re.sub(r'([a-zA-Z0-9_.()+\-*/\s]+):\s*any(?=[+\-*/})\],;])', r'\1', content)

        # Additional fixes for malformed type annotations
        content = re.sub(r':\s*any(?=\s*[,})\]])', '', content)

        # Write the fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        changes_made = content != original_content
        return changes_made

    except Exception as e:
        print(f"Error fixing file {file_path}: {e}")
        return False

if __name__ == "__main__":
    file_path = "src/index-enhanced.ts"

    if fix_syntax_errors(file_path):
        print(f"✅ Fixed syntax errors in {file_path}")
    else:
        print(f"❌ No changes made to {file_path} or error occurred")