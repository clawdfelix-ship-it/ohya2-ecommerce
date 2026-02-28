# Sample Product Data Format (JSON)

This file shows the expected format for importing products from nipporigift data.

## Product Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | integer | Auto | Unique identifier |
| name | string | Yes | Product name |
| description | string | No | Product description |
| price | number | Yes | Product price (HKD) |
| category | string | No | Product category |
| image | string | No | Image URL path |
| stock | integer | No | Stock quantity |
| active | boolean | No | Product visibility |

## Example JSON Format

```json
[
  {
    "name": "Premium Vibrator",
    "description": "High-quality premium vibrator with multiple settings",
    "price": 599.00,
    "category": "Vibrators",
    "image": "/uploads/products/vibrator1.jpg",
    "stock": 50,
    "active": true
  },
  {
    "name": "Couples Massage Set",
    "description": "Luxurious couples massage oil set with warming effects",
    "price": 399.00,
    "category": "Massage",
    "image": "/uploads/products/massage1.jpg",
    "stock": 30,
    "active": true
  }
]
```

## CSV Format Alternative

```csv
name,description,price,category,stock
"Premium Vibrator","High-quality vibrator",599,"Vibrators",50
"Massage Set","Couples massage oils",399,"Massage",30
```

## Image Requirements

- Supported formats: JPG, JPEG, PNG, GIF, WEBP
- Recommended size: 800x800 pixels minimum
- Store images in: `/public/uploads/products/`

## Bank Transfer Configuration

Edit `server.js` to configure bank details:

```javascript
// Around line 200 in checkout handler
const bankDetails = {
  bank: "HSBC",
  accountNumber: "123-456-789",
  accountName: "OHYA2.0"
};
```
