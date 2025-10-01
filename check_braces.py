#!/usr/bin/env python3

with open('hooks/study-context.tsx', 'r') as f:
    lines = f.readlines()

# Count braces from the start of the useEffect
brace_count = 0
print("=== Brace counting from line 399 ===")
for i in range(399, 430):
    if i < len(lines):
        line = lines[i]
        brace_count += line.count('{')
        brace_count -= line.count('}')
        print(f"Line {i+1}: {brace_count} braces - {line.strip()}")
        
        if brace_count < 0:
            print("ERROR: Negative brace count!")
            break

print(f"Final brace count at line 430: {brace_count}")
