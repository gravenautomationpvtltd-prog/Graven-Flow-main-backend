import { Helmet } from "react-helmet-async";
import { Box } from "lucide-react";
import { ProductsManagement } from "@/components/settings/ProductsManagement";
import { useAuth } from "@/hooks/useAuth";
import { AccessDenied } from "@/components/ui/access-denied";
import { useTranslation } from "@/lib/i18n";

const Products = () => {
  const { isAdmin, isManager, isProcurement, isBIE } = useAuth();
  const { t } = useTranslation();
  
  const canAccess = isAdmin || isManager || isProcurement || isBIE;

  if (!canAccess) {
    return <AccessDenied />;
  }

  return (
    <>
      <Helmet>
        <title>{t('products.title', 'Product Catalog')} | Graven Automation</title>
        <meta name="description" content={t('products.subtitle', 'Manage products for quotations and orders')} />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Box className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{t('products.title', 'Product Catalog')}</h1>
            <p className="text-muted-foreground">{t('products.subtitle', 'Manage products for quotations and orders')}</p>
          </div>
        </div>

        <ProductsManagement />
      </div>
    </>
  );
};

export default Products;
