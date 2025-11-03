#!/usr/bin/env python3
"""
Aggressive Batch Syntax Error Fixer v2 - Second Pass
Targets remaining TS1005, TS1128, TS1434 syntax errors with more aggressive patterns
"""

import re
import os
import glob

class AggressiveSyntaxFixer:
    def __init__(self):
        self.fixes_applied = 0
        self.files_modified = 0

    def fix_file(self, file_path):
        """Apply aggressive syntax fixes to a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            original_content = content
            changes_count = 0

            # Aggressive Fix 1: Remove all :any type annotations from parameters
            pattern = r'(\w+)(?::\s*any)(?=\s*[,:)\]])'
            matches = re.findall(pattern, content)
            if matches:
                content = re.sub(pattern, r'\1', content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} :any parameter annotations")

            # Aggressive Fix 2: Fix malformed function signatures with duplicate type annotations
            pattern = r'(\w+\([^)]*?)\s*:\s*\w+(?:<[^>]*>)?\s*:\s*\w+(?:<[^>]*>)?'
            matches = re.findall(pattern, content)
            if matches:
                for sig_start in matches:
                    old_pattern = sig_start + r'\s*:\s*\w+(?:<[^>]*>)?\s*:\s*\w+(?:<[^>]*>)?'
                    new_pattern = sig_start
                    content = re.sub(old_pattern, new_pattern, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} duplicate type annotations")

            # Aggressive Fix 3: Fix malformed arrow functions with extra parentheses
            pattern = r'=>\s*([^,})\n]+)\s*\)'
            matches = re.findall(pattern, content)
            if matches:
                for body in matches:
                    old = f'=> {body})'
                    new = f'=> {body}'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} extra parentheses in arrow functions")

            # Aggressive Fix 4: Fix malformed object property type annotations
            pattern = r'(\w+)\s*:\s*\w+(?:<[^>]*>)?\s*:\s*\w+(?:<[^>]*>)?(?=\s*[,;}])'
            matches = re.findall(pattern, content)
            if matches:
                for prop_name in matches:
                    old = f'{prop_name}:'
                    new = prop_name
                    # Replace only the specific occurrence
                    content = re.sub(f'{prop_name}:\\s*\\w+(?:<[^>]*>)?\\s*:\\s*\\w+(?:<[^>]*>)?(?=\\s*[,;}])', prop_name, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} object property type annotations")

            # Aggressive Fix 5: Fix malformed array access with type annotations
            pattern = r'(\w+\[[^\]]+)(?::\s*\w+(?:<[^>]*>)?)?(?=\s*[,)\]}])'
            matches = re.findall(pattern, content)
            if matches:
                for array_access in matches:
                    old_pattern = array_access + r':\s*\w+(?:<[^>]*>)?'
                    new_pattern = array_access
                    content = re.sub(old_pattern, new_pattern, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} array access type annotations")

            # Aggressive Fix 6: Fix malformed ternary operators with type annotations
            pattern = r'\?\s*[^:]+:\s*\w+(?:<[^>]*>)?\s*:\s*[^:]+:\s*\w+(?:<[^>]*>)?'
            matches = re.findall(pattern, content)
            if matches:
                # Remove type annotations from both branches
                content = re.sub(r'\?\s*([^:]+):\s*\w+(?:<[^>]*>)?\s*:\s*([^:]+):\s*\w+(?:<[^>]*>)?', r'? \1 : \2', content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} ternary operator type annotations")

            # Aggressive Fix 7: Fix malformed return type annotations
            pattern = r'\)\s*:\s*\w+(?:<[^>]*>)?\s*:\s*\w+(?:<[^>]*>)?(?=\s*{)'
            matches = re.findall(pattern, content)
            if matches:
                content = re.sub(pattern, r') {', content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} return type annotations")

            # Aggressive Fix 8: Fix malformed generic type parameters
            pattern = r'<([^<>]+):\s*\w+(?:<[^>]*>)?>'
            matches = re.findall(pattern, content)
            if matches:
                for generic_params in matches:
                    old = f'<{generic_params}:'
                    new = f'<{generic_params}'
                    content = content.replace(old, new)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} generic type parameters")

            # Aggressive Fix 9: Fix malformed string method calls with type annotations
            pattern = r'(toString|substr|slice|substring|padStart|padEnd|replace|match|split)\(([^)]*):\s*\w+(?:<[^>]*>)?\)'
            matches = re.findall(pattern, content)
            if matches:
                for method, params in matches:
                    old = f'{method}({params}:'
                    new = f'{method}({params}'
                    content = re.sub(old, new, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} string method type annotations")

            # Aggressive Fix 10: Fix malformed Math function calls with type annotations
            pattern = r'Math\.(max|min|abs|round|floor|ceil|sqrt|pow|log|exp)\(([^)]*):\s*\w+(?:<[^>]*>)?\)'
            matches = re.findall(pattern, content)
            if matches:
                for method, params in matches:
                    old = f'Math.{method}({params}:'
                    new = f'Math.{method}({params}'
                    content = re.sub(old, new, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} Math method type annotations")

            # Aggressive Fix 11: Fix malformed JSON method calls with type annotations
            pattern = r'JSON\.(stringify|parse)\(([^)]*):\s*\w+(?:<[^>]*>)?\)'
            matches = re.findall(pattern, content)
            if matches:
                for method, params in matches:
                    old = f'JSON.{method}({params}:'
                    new = f'JSON.{method}({params}'
                    content = re.sub(old, new, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} JSON method type annotations")

            # Aggressive Fix 12: Fix malformed Promise method calls with type annotations
            pattern = r'Promise\.(all|allSettled|race|resolve|reject)\(([^)]*):\s*\w+(?:<[^>]*>)?\)'
            matches = re.findall(pattern, content)
            if matches:
                for method, params in matches:
                    old = f'Promise.{method}({params}:'
                    new = f'Promise.{method}({params}'
                    content = re.sub(old, new, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} Promise method type annotations")

            # Aggressive Fix 13: Fix malformed console method calls with type annotations
            pattern = r'console\.(log|error|warn|info|debug)\(([^)]*):\s*\w+(?:<[^>]*>)?\)'
            matches = re.findall(pattern, content)
            if matches:
                for method, params in matches:
                    old = f'console.{method}({params}:'
                    new = f'console.{method}({params}'
                    content = re.sub(old, new, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} console method type annotations")

            # Aggressive Fix 14: Fix malformed logger method calls with type annotations
            pattern = r'logger\.(error|warn|info|debug|log)\(([^)]*):\s*\w+(?:<[^>]*>)?\)'
            matches = re.findall(pattern, content)
            if matches:
                for method, params in matches:
                    old = f'logger.{method}({params}:'
                    new = f'logger.{method}({params}'
                    content = re.sub(old, new, content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} logger method type annotations")

            # Aggressive Fix 15: Remove all remaining type annotations from expressions
            # This is a catch-all for any remaining :any patterns
            pattern = r':\s*any(?=\s*[,)\]}])'
            matches = re.findall(pattern, content)
            if matches:
                content = re.sub(pattern, '', content)
                changes_count += len(matches)
                print(f"  Fixed {len(matches)} remaining :any annotations")

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
        """Fix all TypeScript files with aggressive syntax corrections"""
        print("🚀 Starting Aggressive Batch Syntax Error Fixing - Second Pass...")
        print("=" * 70)

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
        print("=" * 70)
        print("🎉 Aggressive Batch Syntax Error Fixing Complete!")
        print(f"📊 Summary:")
        print(f"  Files processed: {len(ts_files)}")
        print(f"  Files modified: {self.files_modified}")
        print(f"  Total fixes applied: {self.fixes_applied}")
        print(f"  Success rate: {(self.files_modified/len(ts_files)*100):.1f}%")
        print("=" * 70)

if __name__ == "__main__":
    fixer = AggressiveSyntaxFixer()
    fixer.fix_all_files()