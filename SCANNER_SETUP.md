# TurboScout QR Scanner Setup Guide

## Google Sheets Header Setup

Your Google Sheets **MUST** have these exact headers in this exact order:

```
Version | Match | Team | Scouter | Position | Auto_Fuel | Auto_Climb | Auto_Won | Auto_Transition | Shift1_Fuel | Shift1_Defense | Shift1_Defense_Tags | Shift2_Fuel | Shift2_Defense | Shift2_Defense_Tags | Shift3_Fuel | Shift3_Defense | Shift3_Defense_Tags | Shift4_Fuel | Shift4_Defense | Shift4_Defense_Tags | Total_Fuel | Endgame_Climb | Endgame_Descend | Endgame_Died | Keywords | Timestamp
```

### Column Descriptions:
- **Version**: Format version (always "TS1")
- **Match**: Match number
- **Team**: Team number
- **Scouter**: Scout initials
- **Position**: Alliance position (Red1, Red2, Red3, Blue1, Blue2, Blue3)
- **Auto_Fuel**: Fuel scored in autonomous
- **Auto_Climb**: Climb attempt in auto (No Climb, Climb, Pullup)
- **Auto_Won**: Won autonomous? (Y/N)
- **Auto_Transition**: Notes about transition shift
- **Shift1_Fuel** through **Shift4_Fuel**: Fuel scored per shift
- **Shift1_Defense** through **Shift4_Defense**: Defense rating (0-5 stars)
- **Shift1_Defense_Tags** through **Shift4_Defense_Tags**: Defense behavior tags
- **Total_Fuel**: Sum of all fuel scored
- **Endgame_Climb**: Endgame climb result (None, Attempt, Success)
- **Endgame_Descend**: Can descend? (Y/N)
- **Endgame_Died**: Robot died? (Y/N)
- **Keywords**: Performance keywords (comma-separated)
- **Timestamp**: Unix timestamp when QR was generated

## Scanner Configuration

### Required Settings:
1. **Mode**: USB HID Keyboard
2. **Suffix**: Enter (Carriage Return)
3. **Prefix**: None
4. **Character Set**: US Keyboard / UTF-8
5. **QR Code**: Enabled
6. **Send TAB Character**: Enabled
7. **Translate Tab to Space**: Disabled

### Testing Your Scanner:
1. Open Notepad or TextEdit
2. Scan a test QR code containing: `A\tB\tC`
3. **Good Result**: Cursor jumps A → B → C, then drops to next line
4. **Bad Result**: You see spaces or literal `\t` characters

## Usage Workflow:
1. Open your Google Sheet
2. Click the first empty cell in a new row
3. Scan the QR code from TurboScout
4. Data automatically fills the entire row

## Pro Tips:
- Freeze the header row to prevent accidental overwrites
- Add conditional formatting to highlight incomplete rows
- Protect the header row from scanner input
- Use data validation on key columns (team numbers, match numbers)

## Troubleshooting:

### Problem: Columns are shifted
- **Cause**: Missing field in data or header mismatch
- **Solution**: Verify header order matches exactly

### Problem: Row breaks unexpectedly
- **Cause**: Newline characters in notes field
- **Solution**: App automatically sanitizes this

### Problem: Scanner overwrites existing data
- **Cause**: Scanner not configured to send Enter
- **Solution**: Enable "Suffix: Enter" in scanner settings

### Problem: Garbage characters appear
- **Cause**: Unicode/encoding issues
- **Solution**: Set scanner to US Keyboard character set

### Problem: Duplicate rows
- **Cause**: Double scanning
- **Solution**: Use timestamp column to identify and filter duplicates
