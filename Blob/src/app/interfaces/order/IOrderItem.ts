import { ICustomerItem } from '../customer/ICustomerItem';
import { EOrderState } from 'src/app/enums/order/eorder-state.enum';

export interface IOrderItem {
    id: number;
    locationId: number;
    customer: ICustomerItem;
    createdAt: string;
    orderedProduct:any[];
    state: EOrderState;
}
