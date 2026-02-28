<script>
function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('p-id').value = p.id;
  document.getElementById('p-code').value = p.product_code || '';
  document.getElementById('p-name').value = p.name || '';
  document.getElementById('p-price').value = p.price || 0;
  document.getElementById('p-desc').value = p.description || '';
  document.getElementById('p-stock').value = p.stock || 0;
  document.getElementById('p-category').value = p.category || '';
  document.getElementById('p-barcode').value = p.barcode || '';
  document.getElementById('p-image').value = p.image_url || '';
  document.getElementById('product-modal').classList.add('active');
}
function deleteProduct(id) {
  if (confirm('確定要刪除呢件產品?')) {
    products = products.filter(x => x.id !== id);
    renderProducts();
  }
}
</script>