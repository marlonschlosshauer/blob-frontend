
import { ICategoryItem } from './ICategoryItem';
import { IPropertyItem } from './IPropertyItem';
import { IProductLocationItem } from './IProductLocationItem';

export interface IProductItem {
    id: number;
    productservice: string;
    name: string;
    sku?: string;
    category: ICategoryItem[];
    productsAtLocations: IProductLocationItem[];
    property: IPropertyItem[];
    price: number;
}