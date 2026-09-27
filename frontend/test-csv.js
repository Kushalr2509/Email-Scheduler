const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = "name,email\nJohn,john@example.com\nJane,\"jane@example.com\"\nJack,jack@example.com\r\n";
const rows = text.split('\n');
const valid = [];
const invalid = [];

rows.forEach((row, index) => {
  const parts = row.split(/[,;]/);
  parts.forEach(part => {
    const clean = part.trim().toLowerCase();
    if (clean) {
      if (emailRegex.test(clean)) {
        valid.push(clean);
      } else if (part.includes('@')) {
        invalid.push(`Row ${index + 1}: ${part.trim()}`);
      }
    }
  });
});
console.log("Valid:", valid);
console.log("Invalid:", invalid);
