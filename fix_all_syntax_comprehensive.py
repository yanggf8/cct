#!/usr/bin/env python3
"""
Comprehensive syntax error fix for all TypeScript files
"""

import re
import os
import glob

def fix_comprehensive_syntax_errors(file_path):
    """Comprehensive syntax error fix for a TypeScript file"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix malformed type annotations in function parameters
        # pattern: param: Type: any
        content = re.sub(r'(\w+):\s*([^:]+):\s*any', r'\1: \2', content)
        content = re.sub(r'(\w+):\s*any:\s*any', r'\1: any', content)

        # Fix malformed type annotations in object properties
        # pattern: property: Type: any
        content = re.sub(r'(\w+):\s*([^:]+):\s*any', r'\1: \2', content)

        # Fix malformed type annotations in expressions
        # pattern: expression: any
        content = re.sub(r'([a-zA-Z0-9_.()\[\]{}+\-*/\s]+):\s*any(?=[,)}\];])', r'\1', content)

        # Fix malformed type annotations in variable declarations
        # pattern: const var: Type: any = value
        content = re.sub(r'(const|let|var)\s+(\w+):\s*([^:]+):\s*any\s*=', r'\1 \2: \3 =', content)

        # Fix malformed type annotations in function returns
        # pattern: (): Type: any =>
        content = re.sub(r'\(\s*\):\s*([^:]+):\s*any\s*=>', r'(): \1 =>', content)

        # Fix malformed type annotations in method parameters
        # pattern: method(param: Type: any)
        content = re.sub(r'(\w+)\(([^)]*):\s*([^:]+):\s*any\s*\)', r'\1(\2: \3)', content)

        # Fix malformed type annotations in array types
        # pattern: Array<Type: any>
        content = re.sub(r'Array<([^>]+):\s*any\s*>', r'Array<\1>', content)

        # Fix malformed type annotations in generic types
        # pattern: Type<Type: any>
        content = re.sub(r'(\w+)<([^>]+):\s*any\s*>', r'\1<\2>', content)

        # Fix malformed type annotations in Promise types
        # pattern: Promise<Type: any>
        content = re.sub(r'Promise<([^>]+):\s*any\s*>', r'Promise<\1>', content)

        # Fix malformed type annotations in Record types
        # pattern: Record<Type: any, Type2: any>
        content = re.sub(r'Record<([^,]+):\s*any,\s*([^>]+):\s*any\s*>', r'Record<\1, \2>', content)

        # Fix malformed type annotations in function calls
        # pattern: function(param: any, param2: any): any
        content = re.sub(r'(\w+)\(([^)]*):\s*any\s*\)', r'\1(\2)', content)

        # Fix malformed type annotations in arrow functions
        # pattern: (param: any): any => result
        content = re.sub(r'\(([^)]*):\s*any\s*):\s*any\s*=>\s*([^)]*)', r'((\1): any) => \2', content)

        # Fix malformed type annotations in ternary operators
        # pattern: condition ? expr1: any : expr2: any
        content = re.sub(r'\?\s*([^:]+):\s*any\s*:\s*([^:]+):\s*any', r'? \1 : \2', content)

        # Fix malformed type annotations in object literals
        # pattern: { prop: Type: any }
        content = re.sub(r'(\{\s*\w+):\s*([^:]+):\s*any\s*:\s*', r'{ \1: \2: ', content)

        # Fix malformed type annotations in destructuring
        # pattern: { prop: Type: any } = obj
        content = re.sub(r'(\{\s*\w+):\s*([^:]+):\s*any\s*\}\s*=', r'{ \1: \2 } =', content)

        # Fix malformed type annotations in class properties
        # pattern: property: Type: any
        content = re.sub(r'(\s*)(\w+):\s*([^:]+):\s*any\s*[,;]', r'\1\2: \3;', content)

        # Fix malformed type annotations in interface properties
        # pattern: property: Type: any
        content = re.sub(r'(\s*)(\w+):\s*([^:]+):\s*any\s*[;,]', r'\1\2: \3;', content)

        # Fix malformed type annotations in catch blocks
        # pattern: catch (error: any: any)
        content = re.sub(r'catch\s*\(\s*(\w+):\s*any:\s*any\s*\)', r'catch (\1: any)', content)

        # Fix malformed type annotations in if statements
        # pattern: if (condition: any)
        content = re.sub(r'if\s*\(\s*([^)]+):\s*any\s*\)', r'if (\1)', content)

        # Fix malformed type annotations in for loops
        # pattern: for (let i: any = 0; i < n; i++)
        content = re.sub(r'for\s*\(\s*let\s+(\w+):\s*any\s*=', r'for (let \1 =', content)

        # Fix malformed type annotations in while loops
        # pattern: while (condition: any)
        content = re.sub(r'while\s*\(\s*([^)]+):\s*any\s*\)', r'while (\1)', content)

        # Fix malformed type annotations in switch statements
        # pattern: switch (expression: any)
        content = re.sub(r'switch\s*\(\s*([^)]+):\s*any\s*\)', r'switch (\1)', content)

        # Fix malformed type annotations in return statements
        # pattern: return expression: any
        content = re.sub(r'return\s+([a-zA-Z0-9_.()\[\]{}+\-*/\s]+):\s*any', r'return \1', content)

        # Fix malformed type annotations in throw statements
        # pattern: throw expression: any
        content = re.sub(r'throw\s+([a-zA-Z0-9_.()\[\]{}+\-*/\s]+):\s*any', r'throw \1', content)

        # Write the fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        changes_made = content != original_content
        return changes_made

    except Exception as e:
        print(f"Error fixing file {file_path}: {e}")
        return False

def fix_all_comprehensive():
    """Find and fix all syntax errors in all TypeScript files"""

    # Find all TypeScript files
    ts_files = glob.glob('src/**/*.ts', recursive=True)

    fixed_files = []

    for file_path in ts_files:
        if fix_comprehensive_syntax_errors(file_path):
            fixed_files.append(file_path)
            print(f"✅ Fixed comprehensive errors: {file_path}")

    print(f"\n📊 Summary:")
    print(f"  Files fixed: {len(fixed_files)}")

    return len(fixed_files)

if __name__ == "__main__":
    print("🔧 Fixing comprehensive syntax errors in all TypeScript files...")
    fixed_count = fix_all_comprehensive()

    if fixed_count > 0:
        print(f"\n🎉 Successfully fixed comprehensive errors in {fixed_count} TypeScript files!")
    else:
        print("\n✅ No comprehensive syntax errors found")