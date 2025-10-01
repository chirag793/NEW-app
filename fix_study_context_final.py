#!/usr/bin/env python3

with open('hooks/study-context.tsx', 'r') as f:
    lines = f.readlines()

# Remove the extra closing brace at line 419
if len(lines) > 419:
    print("Removing extra brace at line 420 (0-indexed 419)")
    lines.pop(419)

# Write back
with open('hooks/study-context.tsx', 'w') as f:
    f.writelines(lines)

print("Fixed study-context.tsx")
