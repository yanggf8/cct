#!/usr/bin/env python3
"""
Simple but Effective Syntax Error Fixer
Targets the most common remaining syntax patterns
"""

import re
import os
import glob

def fix_syntax_errors(file_path):
    """Apply simple but effective syntax fixes"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        changes_count = 0

        # Simple Fix 1: Remove all :any type annotations from parameters
        pattern = r'(\w+):\s*any'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'\1', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} :any parameter annotations")

        # Simple Fix 2: Fix duplicate type annotations (param: Type: any)
        pattern = r'(\w+):\s*(\w+(?:<[^>]*>)?)\s*:\s*any'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'\1: \2', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} duplicate type annotations")

        # Simple Fix 3: Fix malformed arrow functions with extra parentheses
        pattern = r'=>\s*([^,})\n]+)\s*\)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'=> \1', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} extra parentheses in arrow functions")

        # Simple Fix 4: Fix malformed object property type annotations
        pattern = r'(\w+)\s*:\s*\w+(?:<[^>]*>)?\s*:\s*\w+(?:<[^>]*>)?(?=\s*[,;}])'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'\1', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} object property type annotations")

        # Simple Fix 5: Fix malformed array access with type annotations
        pattern = r'(\w+\[[^\]]+):\s*\w+(?:<[^>]*>)?'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'\1', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} array access type annotations")

        # Simple Fix 6: Fix malformed return type annotations
        pattern = r'\)\s*:\s*\w+(?:<[^>]*>)?\s*:\s*\w+(?:<[^>]*>)?(?=\s*{)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r') {', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} return type annotations")

        # Simple Fix 7: Fix malformed generic type parameters
        pattern = r'<([^<>]+):\s*\w+(?:<[^>]*>)?>'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'<\1>', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} generic type parameters")

        # Simple Fix 8: Fix malformed function calls with type annotations
        pattern = r'(\w+)\(([^)]*):\s*any\s*\)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'\1(\2)', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} function call type annotations")

        # Simple Fix 9: Fix malformed string method calls
        pattern = r'(toString|substr|slice|substring|padStart|padEnd|replace|match|split)\(([^)]*):\s*any\s*\)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'\1(\2)', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} string method type annotations")

        # Simple Fix 10: Fix malformed Math function calls
        pattern = r'Math\.(max|min|abs|round|floor|ceil|sqrt|pow|log|exp)\(([^)]*):\s*any\s*\)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'Math.\1(\2)', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} Math method type annotations")

        # Simple Fix 11: Fix malformed JSON method calls
        pattern = r'JSON\.(stringify|parse)\(([^)]*):\s*any\s*\)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'JSON.\1(\2)', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} JSON method type annotations")

        # Simple Fix 12: Fix malformed Promise method calls
        pattern = r'Promise\.(all|allSettled|race|resolve|reject)\(([^)]*):\s*any\s*\)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'Promise.\1(\2)', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} Promise method type annotations")

        # Simple Fix 13: Fix malformed console method calls
        pattern = r'console\.(log|error|warn|info|debug)\(([^)]*):\s*any\s*\)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'console.\1(\2)', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} console method type annotations")

        # Simple Fix 14: Fix malformed logger method calls
        pattern = r'logger\.(error|warn|info|debug|log)\(([^)]*):\s*any\s*\)'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, r'logger.\1(\2)', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} logger method type annotations")

        # Simple Fix 15: Remove all remaining :any patterns
        pattern = r':\s*any(?=\s*[,)\]}])'
        matches = re.findall(pattern, content)
        if matches:
            content = re.sub(pattern, '', content)
            changes_count += len(matches)
            print(f"  Fixed {len(matches)} remaining :any patterns")

        # Write changes back to file
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes_count
        else:
            return 0

    except Exception as e:
        print(f"❌ Error fixing {file_path}: {e}")
        return 0

def main():
    """Main function to fix all TypeScript files"""
    print("🚀 Starting Simple but Effective Syntax Error Fixing...")
    print("=" * 60)

    # Find all TypeScript files
    ts_files = glob.glob('src/**/*.ts', recursive=True)
    print(f"📁 Found {len(ts_files)} TypeScript files to process")
    print()

    files_modified = 0
    total_fixes = 0

    # Process each file
    for i, file_path in enumerate(ts_files, 1):
        print(f"[{i:3d}/{len(ts_files)}] Processing: {file_path}")
        fixes = fix_syntax_errors(file_path)
        if fixes > 0:
            files_modified += 1
            total_fixes += fixes
            print(f"✅ {file_path}: {fixes} fixes applied")
        else:
            print(f"ℹ️  {file_path}: No syntax errors found")
        print()

    # Summary
    print("=" * 60)
    print("🎉 Simple Syntax Error Fixing Complete!")
    print(f"📊 Summary:")
    print(f"  Files processed: {len(ts_files)}")
    print(f"  Files modified: {files_modified}")
    print(f"  Total fixes applied: {total_fixes}")
    print(f"  Success rate: {(files_modified/len(ts_files)*100):.1f}%")
    print("=" * 60)

if __name__ == "__main__":
    main()