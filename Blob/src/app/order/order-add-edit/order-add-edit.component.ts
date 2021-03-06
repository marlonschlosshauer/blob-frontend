import { Component, OnInit } from '@angular/core';
import { CustomerService } from 'src/app/customer/customer.service';
import { TitleService } from 'src/app/title.service';
import { FormBuilder, FormGroup, FormControl, Validators, FormArray, ValidatorFn, ValidationErrors } from '@angular/forms';
import { OrderService } from '../order.service';
import { ICustomerItem } from 'src/app/interfaces/customer/ICustomerItem';
import { NzTableCellDirective, NzModalService } from 'ng-zorro-antd';
import { IOrderItem } from 'src/app/interfaces/order/IOrderItem';
import { EOrderState } from 'src/app/enums/order/eorder-state.enum';
import { ActivatedRoute, Router } from '@angular/router';
import { IProductItem } from 'src/app/interfaces/product/IProductItem';
import { ProductService } from 'src/app/product/product.service';
import { IOrderProduct } from 'src/app/interfaces/order/IOrderProduct';

@Component({
  selector: 'app-order-add-edit',
  templateUrl: './order-add-edit.component.html',
  styleUrls: ['./order-add-edit.component.less']
})
export class OrderAddEditComponent implements OnInit {

  addForm: FormGroup;
  customers: ICustomerItem[];
  products: IProductItem[];
  displayProducts: IProductItem[];
  isLoading: boolean = true;
  currentInvoiceMount: string = "0";
  orderId: number;
  currentOrder: IOrderItem = null;


  constructor(private modal:NzModalService,private router: Router,private route: ActivatedRoute, private fb:FormBuilder, private titleService:TitleService, private customerService: CustomerService, private orderService: OrderService, private productService: ProductService) { 
    this.titleService.Title = 'Bestellung hinzufügen';
  }

  ngOnInit(): void {

    this.addForm = this.fb.group({
      customerId: new FormControl(null, Validators.required),
      customerName: new FormControl({value: null, disabled:true}),
      street: new FormControl({value: null, disabled:true}),
      city: new FormControl({value: null, disabled:true}),
      //allProducts: this.fb.group({
        products: this.fb.array([]),
        productsOrdered: this.fb.array([]),
      //}, Validators.required),
    },{ validators: productValidation })
  
    this.route.paramMap.subscribe(params => {
      this.orderId = Number(params.get('id'));
    });

    this.getAllCustomer();
    this.getAllProducts();
    this.calcInvoiceMount();
  }

  get formControls() { return this.addForm.controls; }
  get orderProducts() { return this.formControls.products as FormArray; }
  get orderedProducts() { return this.formControls.productsOrdered as FormArray; }

  getAllCustomer() {
    this.customerService.getAllCustomer().subscribe(
      (data) => {
        this.customers = data;

        if(this.isEditing()){
          this.getOrder();
        }else{
          this.isLoading = false
        }
      },
      (error) => {
        this.isLoading = false;
        this.modal.error({
          nzTitle: 'Fehler',
          nzContent: 'Beim Laden der Bestellung ist ein Fehler aufgetreten, bitte benachrichtigen Sie den Administrator.'
        });
      }
    );
  }

  getAllProducts() {
    this.productService.getAllProducts().subscribe(
      (data) => {
        this.products = data;
        this.updateDisplayedProducts();
      },
      (error) => {
        this.isLoading = false;

          this.modal.error({
            nzTitle: 'Fehler',
            nzContent: 'Beim Laden der Bestellung ist ein Fehler aufgetreten, bitte benachrichtigen Sie den Administrator.'
          });
      }
    );
  }

  getOrder() {
    this.orderService.getOrder(this.orderId).subscribe(
      (data) => {
        this.currentOrder = data;
        if(this.currentOrder.customer){
          this.addForm.controls["customerId"].setValue(this.currentOrder.customer.id);
          this.addForm.controls["customerName"].setValue(this.currentOrder.customer.firstname+" "+this.currentOrder.customer.lastname);
          this.addForm.controls["street"].setValue(this.currentOrder.customer.address.street);
          this.addForm.controls["city"].setValue(this.currentOrder.customer.address.zip+", "+this.currentOrder.customer.address.city);
        }

        if(data.orderedProducts != null){
          for(let orderProduct of data.orderedProducts){
            this.orderedProducts.push(this.createItemOrdered(orderProduct.id,orderProduct.name,orderProduct.quantity, orderProduct.price));
          }
        }
        
        this.calcInvoiceMount();
        this.isLoading = false
      },
      (error) => {
        this.isLoading = false;

        this.modal.error({
          nzTitle: 'Fehler',
          nzContent: 'Beim Laden der Bestellung ist ein Fehler aufgetreten, bitte benachrichtigen Sie den Administrator.'
        });
      }
    );
  }

  isEditing(){
    return this.orderId>0;
  }

  submitAddForm(): void{
   this.isLoading = true;
    
    var products: IOrderProduct[] = this.buildProductsForSend();


    var newOrderItem: IOrderItem = {
      id: this.orderId,
      createdAt: null,
      customer: {
        id: this.addForm.controls["customerId"].value,
        firstname: null,
        lastname: null,
        address: null,
        createdAt: null,
      },
      orderedProducts:products,
      state: {
        id: EOrderState.notPaid,
        value: "Nicht Bezahlt",
      }
    }

    if(this.orderId>0){

      this.orderService.updateOrders([newOrderItem]).subscribe(
        (data) => {
          this.router.navigate(['/order']);
        },
        (error) => {
          this.isLoading = false;

          this.modal.error({
            nzTitle: 'Fehler beim Bearbeiten',
            nzContent: 'Beim Bearbeiten der Bestellung ist ein Fehler aufgetreten, bitte benachrichtigen Sie den Administrator.'
          });
        }
      );
    }else{
      this.orderService.createOrder(newOrderItem).subscribe(
        (data) => {
          this.router.navigate(['/order']);
        },
        (error) => {
          this.isLoading = false;

          var errorSplit = error.Error.error.split(":");
          
          if(errorSplit.length>0&&errorSplit[0] == "Not enough quantity for productId"){
            var id:number = errorSplit[1];
            var currentProduct: IProductItem[] = this.products.filter(
              (item: IProductItem) => item.id == id
            );
            var name:string = currentProduct.length>0?currentProduct[0].name:"";
            this.modal.error({
              nzTitle: 'Bestellung konnte nicht gespeichert werden',
              nzContent: 'Das Produkt "'+name+'" ist nicht in der gewünschten Menge verfügbar.'
            });
          }else{
            this.modal.error({
              nzTitle: 'Fehler',
              nzContent: 'Beim Anlegen der Bestellung ist ein Fehler aufgetreten, bitte benachrichtigen Sie den Administrator.'
            });
          }
        }
      );
    }
  }

  private buildProductsForSend(): IOrderProduct[] {
    var products: IOrderProduct[] = [];
    for (let product of this.orderProducts.controls) {
      var currentQuantity: number = product["controls"]["quantity"].value;

      var currentProduct: IProductItem[] = this.products.filter(
        (item: IProductItem) => item.id == product["controls"]["product"].value
      );
      
      products = [
        ...products,
        {
          id: currentProduct[0].id,
          name: null,
          price: 0,
          sku: null,
          quantity: currentQuantity,
        }
      ];
    }

    for (let product of this.orderedProducts.controls) {
      var currentQuantity: number = product["controls"]["quantity"].value;
      
      products = [
        ...products,
        {
          id: product["controls"]["product"].value,
          name:  product["controls"]["productName"].value,
          price: 0,
          sku: null,
          quantity: currentQuantity,
        }
      ];
    }

    return products;
  }

  createItem(product: number = null, quantity: number = 1, price: number = 0, wasInOrder: boolean = false): FormGroup {
    return this.fb.group({
      product: new FormControl({value: product, disabled:wasInOrder}, [Validators.required]),
      quantity: new FormControl(quantity, [Validators.required]),
      price: new FormControl({value: price, disabled:true})
    });
  }

  createItemOrdered(productId:number, productName: string, quantity: number, price: number): FormGroup {
    return this.fb.group({
      product: new FormControl(productId, [Validators.required]),
      productName: new FormControl({value: productName, disabled:true}),
      quantity: new FormControl(quantity, [Validators.required]),
      price: new FormControl({value: price, disabled:true})
    });
  }

  addProduct(e: MouseEvent) {
    e.preventDefault();
    var test: FormArray = this.formControls.products as FormArray;
    
    this.orderProducts.push(this.createItem());
    this.calcInvoiceMount();
    this.updateDisplayedProducts();
  }

  removeProduct(index: number) {
    this.orderProducts.removeAt(index);
    this.calcInvoiceMount();
    this.updateDisplayedProducts();
  }

  removeOrderedProduct(index: number) {
    this.orderedProducts.removeAt(index);
    this.calcInvoiceMount();
    this.updateDisplayedProducts();
  }

  calcInvoiceMount(): void{
    var mount: number = 0;
    for (let product of this.orderProducts.controls) {
      var currentQuantity: number = product["controls"]["quantity"].value;
      var currentPrice: number = Number(product["controls"]["price"].value);
      mount += currentQuantity*currentPrice;
    }

    for (let product of this.orderedProducts.controls) {
      var currentQuantity: number = product["controls"]["quantity"].value;
      var currentPrice: number = Number(product["controls"]["price"].value);
      mount += currentQuantity*currentPrice;
    }
    this.currentInvoiceMount = mount.toFixed(2);
  }

  customerChanged(): void{
    var customer: ICustomerItem[] = this.customers.filter(
      (item: ICustomerItem) => item.id == this.addForm.controls["customerId"].value
    );

    if(customer.length<= 0){
      return;
    }
    this.addForm.controls["street"].setValue(customer[0].address.street);
    this.addForm.controls["city"].setValue(customer[0].address.zip+", "+customer[0].address.city);
  }

  productChanged(index: number): void{
    
    var product: IProductItem[] = this.products.filter(
      (item: IProductItem) => item.id == this.orderProducts.controls[index]["controls"]["product"].value
    );

    if(product.length<= 0){
      return;
    }

    this.orderProducts.controls[index]["controls"]["price"].setValue(product[0].price);
    this.calcInvoiceMount();
    this.updateDisplayedProducts();
  }

  updateDisplayedProducts(){
    var ids: number[] = [];
    for (let product of this.orderProducts.controls) {
      var currentProduct: IProductItem[] = this.products.filter(
        (item: IProductItem) => item.id == product["controls"]["product"].value
      );
      
      if(currentProduct.length<=0){
        continue;
      }
      
      ids = [
        ...ids, currentProduct[0].id
      ];
    }

    for (let product of this.orderedProducts.controls) {
      ids = [
        ...ids, product["controls"]["product"].value
      ];
    }
    
    this.displayProducts = this.products.filter(
      (item: IProductItem) => !ids.includes(item.id)
    )
  }
}

export const productValidation: ValidatorFn = (control: FormGroup): ValidationErrors | null => {
  const products = control.get('products');
  const productsOrdered = control.get('productsOrdered');

  
  return !(products.value.length>0 || productsOrdered.value.length>0) ? { 'productInvalid': true } : null;
};