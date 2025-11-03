#!/usr/bin/env python3
"""
Fix the last remaining syntax errors
"""

import re
import os

def fix_last_syntax_errors(file_path):
    """Fix the last remaining syntax errors in a TypeScript file"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix malformed arrow functions
        # pattern: .then((param => expression)
        content = re.sub(r'\.then\(\(([^)]+)\s*=>\s*([^)]*)\)', r'.then((\1) => \2)', content)

        # Fix malformed function calls
        # pattern: function(param: any)
        content = re.sub(r'(\w+)\(([^)]*):\s*any\s*\)', r'\1(\2)', content)

        # Fix malformed type annotations in function parameters
        # pattern: (param: Type: any)
        content = re.sub(r'\(([^)]*):\s*([^:]+):\s*any\s*\)', r'(\1: \2)', content)

        # Write the fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        changes_made = content != original_content
        return changes_made

    except Exception as e:
        print(f"Error fixing file {file_path}: {e}")
        return False

# Fix specific files with remaining syntax errors
files_to_fix = [
    'src/index-enhanced.ts',
    'src/modules/advanced-risk-management.ts'
]

for file_path in files_to_fix:
    if os.path.exists(file_path):
        if fix_last_syntax_errors(file_path):
            print(f"✅ Fixed last syntax errors: {file_path}")
        else:
            print(f"ℹ️  No changes needed: {file_path}")

print("🎉 Last syntax error fix complete!")