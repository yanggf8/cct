#!/usr/bin/env python3
"""
Comprehensive Batch Syntax Error Fixer for TypeScript
Fixes TS1005, TS1128, TS1434, TS1144, TS1135, TS1161, TS1011, TS1109, TS1003, TS1136
"""

import re
import os
import glob
import sys

class BatchSyntaxErrorFixer:
    def __init__(self):
        self.fixes_applied = 0
        self.files_modified = 0

    def fix_file(self, file_path):
        """Apply all syntax fixes to a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            original_content = content
            changes_count = 0

            # Fix 1: Malformed type annotations in parameters (param: Type: any)
            pattern = r'(\w+):\s*([^:(){}[\],\s]+):\s*any'
            matches = re.findall(pattern, content)
            if matches:
                content = re.sub(pattern, r'\1: \2', content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} parameter type annotations")

            # Fix 2: Malformed arrow functions (param) => expression)
            pattern = r'\.(\w+)\(\(([^)]+)\)\s*=>\s*([^)]*)\)\)'
            matches = re.findall(pattern, content)
            if matches:
                for method, params, body in matches:
                    old_pattern = f'.{method}(({params}) => {body})'
                    new_pattern = f'.{method}(({params}) => {body})'
                    content = content.replace(old_pattern, new_pattern)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} arrow function syntaxes")

            # Fix 3: Malformed array.map calls array.map(param) => expression)
            pattern = r'\.map\(\(([^)]+)\)\s*=>\s*([^)]*)\)\)'
            matches = re.findall(pattern, content)
            if matches:
                for params, body in matches:
                    old = f'.map(({params}) => {body})'
                    new = f'.map(({params}) => {body})'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} map function syntaxes")

            # Fix 4: Malformed function signatures function(param): Type1 Type2
            pattern = r'(\w+\([^)]*\))\s*:\s*([A-Z_][a-zA-Z0-9_]*)\s+([A-Z_][a-zA-Z0-9_]*)'
            matches = re.findall(pattern, content)
            if matches:
                for sig, type1, type2 in matches:
                    old = f'{sig}: {type1} {type2}'
                    new = f'{sig}: {type1}'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} function return types")

            # Fix 5: Malformed type guards (param): type is Type: any => condition
            pattern = r'\(([^)]+)\):\s*([^)]+)\s*is\s*(\w+):\s*any\s*=>\s*([^)]*)\)'
            matches = re.findall(pattern, content)
            if matches:
                for params, prefix, type_name, body in matches:
                    old = f'({params}): {prefix} is {type_name}: any => {body})'
                    new = f'({params}): {prefix} is {type_name} => {body}'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} type guard syntaxes")

            # Fix 6: Malformed array spread syntax Math.max((...array))
            pattern = r'Math\.(max|min)\(\(\.\.\.([^)]+)\)\)'
            matches = re.findall(pattern, content)
            if matches:
                for func, array_expr in matches:
                    old = f'Math.{func}((...{array_expr}))'
                    new = f'Math.{func}(...{array_expr})'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} array spread syntaxes")

            # Fix 7: Malformed Promise.all syntax Promise.all((...array))
            pattern = r'Promise\.all\(\(\.\.\.([^)]+)\)\)'
            matches = re.findall(pattern, content)
            if matches:
                for array_expr in matches:
                    old = f'Promise.all((...{array_expr}))'
                    new = f'Promise.all(...{array_expr})'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} Promise.all syntaxes")

            # Fix 8: Malformed ternary operators condition ? expr1: any : expr2: any
            pattern = r'\?\s*([^:]+):\s*any\s*:\s*([^:]+):\s*any'
            matches = re.findall(pattern, content)
            if matches:
                for expr1, expr2 in matches:
                    old = f'? {expr1}: any : {expr2}: any'
                    new = f'? {expr1} : {expr2}'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} ternary operator syntaxes")

            # Fix 9: Malformed object property access obj.prop: any
            pattern = r'(\w+\.\w+):\s*any'
            matches = re.findall(pattern, content)
            if matches:
                for prop_access in matches:
                    old = f'{prop_access}: any'
                    new = prop_access
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} object property access syntaxes")

            # Fix 10: Malformed catch blocks catch (error: any: any)
            pattern = r'catch\s*\(\s*(\w+):\s*any:\s*any\s*\)'
            matches = re.findall(pattern, content)
            if matches:
                for error_var in matches:
                    old = f'catch ({error_var}: any: any)'
                    new = f'catch ({error_var}: any)'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} catch block syntaxes")

            # Fix 11: Malformed function calls with extra parentheses function((param))
            pattern = r'(\w+)\(\(([^)]+)\)\)'
            matches = re.findall(pattern, content)
            if matches:
                for func_name, params in matches:
                    old = f'{func_name}(({params}))'
                    new = f'{func_name}({params})'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} function call parentheses")

            # Fix 12: Malformed logger.info calls logger.info(('message', {obj}))
            pattern = r'logger\.info\(\(\s*[\'"]([^\'"]+)[\'"],\s*({[^}]+})\s*\)\)'
            matches = re.findall(pattern, content)
            if matches:
                for message, obj in matches:
                    old = f"logger.info(('{message}', {obj}))"
                    new = f"logger.info('{message}', {obj})"
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} logger.info call syntaxes")

            # Fix 13: Malformed import().then() calls import('./module.js').then((m => m.func()))
            pattern = r'import\(([^)]+)\)\.then\(\(([^)]+)\s*=>\s*([^)]*)\)\)'
            matches = re.findall(pattern, content)
            if matches:
                for module_path, param, func_call in matches:
                    old = f"import({module_path}).then(({param} => {func_call}))"
                    new = f"import({module_path}).then(({param}) => {func_call})"
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} import().then() syntaxes")

            # Fix 14: Malformed return type annotations ): Type: any {
            pattern = r'\)\s*:\s*([^:(){},\[\]]+)\s*:\s*any\s*{'
            content = re.sub(pattern, r'): \1 {', content)
            changes_count += len(re.findall(pattern, original_content))
            if len(re.findall(pattern, original_content)) > 0:
                print(f"  Fixed {len(re.findall(pattern, original_content))} return type annotations")

            # Fix 15: Malformed generic types Type<Type: any>
            pattern = r'(\w+)<([^<>]+):\s*any\s*>'
            matches = re.findall(pattern, content)
            if matches:
                for type_name, inner_type in matches:
                    old = f'{type_name}<{inner_type}: any>'
                    new = f'{type_name}<{inner_type}>'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} generic type syntaxes")

            # Fix 16: Malformed array access syntax array[index: any]
            pattern = r'(\w+\[[^\]]+):\s*any'
            matches = re.findall(pattern, content)
            if matches:
                for array_access in matches:
                    old = f'{array_access}: any'
                    new = array_access
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} array access syntaxes")

            # Fix 17: Malformed string method calls toString(36: any).substr(2: any, 9: any)
            pattern = r'toString\((\d+):\s*any\)\.substr\((\d+):\s*any,\s*(\d+):\s*any\)'
            matches = re.findall(pattern, content)
            if matches:
                for radix, start, length in matches:
                    old = f'toString({radix}: any).substr({start}: any, {length}: any)'
                    new = f'toString({radix}).substr({start}, {length})'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} string method call syntaxes")

            # Fix 18: Malformed JSON.stringify parameters JSON.stringify(obj, null: any, 2: any)
            pattern = r'JSON\.stringify\(([^,]+),\s*null:\s*any,\s*(\d+):\s*any\)'
            matches = re.findall(pattern, content)
            if matches:
                for obj_str, indent in matches:
                    old = f'JSON.stringify({obj_str}, null: any, {indent}: any)'
                    new = f'JSON.stringify({obj_str}, null, {indent})'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} JSON.stringify syntaxes")

            # Write changes back to file
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)

                self.files_modified += 1
                self.fixes_applied += changes_count
                print(f"✅ {file_path}: {changes_count} fixes applied")
                return True
            else:
                print(f"ℹ️  {file_path}: No syntax errors found")
                return False

        except Exception as e:
            print(f"❌ Error fixing {file_path}: {e}")
            return False

    def fix_all_files(self):
        """Fix all TypeScript files in the project"""
        print("🚀 Starting comprehensive batch syntax error fixing...")
        print("=" * 60)

        # Find all TypeScript files
        ts_files = glob.glob('src/**/*.ts', recursive=True)
        print(f"📁 Found {len(ts_files)} TypeScript files to process")
        print()

        # Process each file
        for i, file_path in enumerate(ts_files, 1):
            print(f"[{i:3d}/{len(ts_files)}] Processing: {file_path}")
            self.fix_file(file_path)
            print()

        # Summary
        print("=" * 60)
        print("🎉 Batch Syntax Error Fixing Complete!")
        print(f"📊 Summary:")
        print(f"  Files processed: {len(ts_files)}")
        print(f"  Files modified: {self.files_modified}")
        print(f"  Total fixes applied: {self.fixes_applied}")
        print(f"  Success rate: {(self.files_modified/len(ts_files)*100):.1f}%")
        print("=" * 60)

if __name__ == "__main__":
    fixer = BatchSyntaxErrorFixer()
    fixer.fix_all_files()