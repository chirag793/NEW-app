#!/usr/bin/env python3

with open('hooks/study-context.tsx', 'r') as f:
    lines = f.readlines()

# The issue is around line 415-420
print("=== Current structure ===")
for i in range(410, 425):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}", end='')

# The structure should be:
# if (isActive) {
#   ... code ...
# }  ← This brace is missing

# Find where to insert the missing brace
for i in range(415, 420):
    if 'setSubjects(DEFAULT_SUBJECTS);' in lines[i]:
        # Insert closing brace after the AsyncStorage block
        insert_line = i + 4  # After the catch block
        if insert_line < len(lines) and '}' in lines[insert_line]:
            # Insert before the existing closing brace
            lines.insert(insert_line, '        }\n')
            break

print("\n=== Fixed structure ===")
for i in range(410, 430):
    if i < len(lines):
        print(f"{i+1}: {lines[i]}", end='')

# Write back
with open('hooks/study-context.tsx', 'w') as f:
    f.writelines(lines)

print("\nMissing brace added!")
