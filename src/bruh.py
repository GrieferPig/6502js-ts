import re

# Function to read text from a file and find occurrences of 'ixx('
def find_hexadecimal_calls(file_path):
    # Read the content of the file
    with open(file_path, 'r') as file:
        text = file.read()

    # Regular expression pattern to match 'i' followed by two hexadecimal digits and an opening parenthesis
    pattern = r'i([0-9A-Fa-f]{2})\('

    # Find all occurrences
    matches = re.findall(pattern, text)
    print(matches)

    # Print the results
    for match in matches:
        print(f"'{match}': this.i{match}, ", end='')

# Specify the path to your file
file_path = 'emu6502.ts'  # Change this to your actual file path
find_hexadecimal_calls(file_path)