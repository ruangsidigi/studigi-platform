export const formatRupiah = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

export const getOriginalPrice = (item) => {
  const originalPrice = Number(item?.original_price ?? item?.originalPrice ?? 0);
  const currentPrice = Number(item?.price ?? 0);

  if (!Number.isFinite(originalPrice) || originalPrice <= currentPrice) {
    return null;
  }

  return originalPrice;
};

export const hasStrikethroughPrice = (item) => getOriginalPrice(item) !== null;