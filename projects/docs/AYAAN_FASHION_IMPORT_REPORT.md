# AYAAN FASHION Import Report

- Source ZIP: `C:\Users\PC\NMM\WhatsApp Chat with AYAAN FASHION.zip`
- Images in ZIP: 29
- Product candidates found: 12
- Priced candidates eligible for import: 0
- Products imported this run: 29
- Mode: admin-image-only
- Default price: 1999
- Rule: skip candidates without a numeric price unless admin image-only mode is used

## Skipped / Review Candidates

### candidate-001
- Title: Under Armour Hiking Khaki Brown
- Price: missing
- Images: IMG-20260528-WA0028.jpg, IMG-20260528-WA0027.jpg, IMG-20260528-WA0026.jpg, IMG-20260528-WA0025.jpg, IMG-20260528-WA0024.jpg, IMG-20260528-WA0023.jpg
- Reason: missing_price

### candidate-002
- Title: Under Armour UA Khaki Brown ( &
- Price: missing
- Images: none
- Reason: missing_price

### candidate-003
- Title: 41 to 45
- Price: missing
- Images: IMG-20260528-WA0022.jpg
- Reason: missing_price

### candidate-004
- Title: Asics Gel Nimbus 26 Graphite Grey
- Price: missing
- Images: IMG-20260528-WA0021.jpg
- Reason: missing_price

### candidate-005
- Title: 
- Price: missing
- Images: IMG-20260528-WA0020.jpg
- Reason: missing_price

### candidate-006
- Title: ���� � ����� ��� ������ ����� 1 ��� ������ ����� ����� (1�� ���� �� ����� & ���� �� ���
- Price: missing
- Images: none
- Reason: missing_price

### candidate-007
- Title: 
- Price: missing
- Images: IMG-20260528-WA0019.jpg
- Reason: missing_price

### candidate-008
- Title: 
- Price: missing
- Images: IMG-20260528-WA0018.jpg, IMG-20260528-WA0017.jpg, IMG-20260528-WA0016.jpg, IMG-20260528-WA0015.jpg
- Reason: missing_price

### candidate-009
- Title: �� ����������� ����� 2 ���������� ������ ������� (1�� ���� �� ����� & ���� �� ���
- Price: missing
- Images: none
- Reason: missing_price

### candidate-010
- Title: Adidas Adizero EVO SL "Core Black"( &
- Price: missing
- Images: IMG-20260528-WA0014.jpg
- Reason: missing_price

### candidate-011
- Title: Adidas terrex sky chaser gore-tex ( &
- Price: missing
- Images: IMG-20260528-WA0013.jpg
- Reason: missing_price

### candidate-012
- Title: Ungrouped media
- Price: missing
- Images: IMG-20260528-WA0012.jpg, IMG-20260528-WA0011.jpg, IMG-20260528-WA0010.jpg, IMG-20260528-WA0009.jpg, IMG-20260528-WA0008.jpg, IMG-20260528-WA0007.jpg, IMG-20260528-WA0006.jpg, IMG-20260528-WA0005.jpg, IMG-20260528-WA0004.jpg, IMG-20260528-WA0000.jpg, IMG-20260528-WA0003.jpg, IMG-20260528-WA0002.jpg, IMG-20260528-WA0001.jpg
- Reason: manual_grouping_required

## Approved Groups JSON Shape

Use this shape with `-ApprovedGroupsPath` and `-Apply` after prices/grouping are confirmed, or use `-AdminImageOnly -DefaultPrice 1999` to create one product per image through Supabase admin catalog storage.

```json
[
  {
    "title": "Product title",
    "price": 1499,
    "images": ["IMG-20260528-WA0001.jpg"],
    "sizes": ["41", "42", "43", "44", "45"],
    "subcategory": "Sports Shoes"
  }
]
```

