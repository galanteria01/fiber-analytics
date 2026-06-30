import { SearchBar } from '../components/controls.js';
import { FilterPanel } from '../components/forms.js';
import { ProductCard, type Product } from '../components/commerce.js';

const PRODUCTS: Product[] = [
  { id: 'sku-aurora', name: 'Aurora Lamp', price: 89, tag: 'New' },
  { id: 'sku-nimbus', name: 'Nimbus Chair', price: 240 },
  { id: 'sku-pebble', name: 'Pebble Speaker', price: 59, tag: 'Sale' },
  { id: 'sku-orbit', name: 'Orbit Desk', price: 420 },
  { id: 'sku-fern', name: 'Fern Planter', price: 32 },
  { id: 'sku-haze', name: 'Haze Diffuser', price: 48, tag: 'Sale' },
];

export function ProductsView() {
  return (
    <div className="view">
      <header className="view-head">
        <h1>Products</h1>
        <SearchBar />
      </header>

      <div className="grid sidebar">
        <aside className="card">
          <h2>Filters</h2>
          <FilterPanel />
        </aside>
        <div className="product-grid">
          {PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
