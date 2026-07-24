import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Home } from './screens/Home';
import { CategoryFeed } from './screens/CategoryFeed';
import { ProductPage } from './screens/ProductPage';
import { BarcodeScan } from './screens/BarcodeScan';
import { ManualBarcode } from './screens/ManualBarcode';
import { ProductPhotoScreen } from './screens/ProductPhoto';
import { NotFound } from './screens/NotFound';
import { RegisterReview } from './screens/RegisterReview';
import { Search } from './screens/Search';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<BarcodeScan />} />
        <Route path="/scan/manual" element={<ManualBarcode />} />
        <Route path="/search" element={<Search />} />
        <Route path="/c/:category" element={<CategoryFeed />} />
        <Route path="/p/:barcode" element={<ProductPage />} />
        <Route path="/p/:barcode/new" element={<NotFound />} />
        <Route path="/p/:barcode/photo" element={<ProductPhotoScreen />} />
        <Route path="/p/:barcode/write" element={<RegisterReview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
