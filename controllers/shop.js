const Product = require('../models/product');
const Order = require('../models/order');
const fs = require('fs');
const path = require('path');
const  PDFDocument = require('pdfkit');
 // down is the secret key from  stripe , always use this on your nodejs code never on your views beacuse your users can see it 
const stripe = require('stripe')(process.env.STRIPE_KEY);
 
const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1 ; //if req.query.page is null then take it as 1
  let totalItems;
  Product.find()
    .countDocuments()
    .then( numProducts =>{
      totalItems = numProducts;
      //to let next then() execute return from current
       return Product.find()
      .skip((page - 1 ) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
    })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products',
        currentPage :page,
        hasNextPage :ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage : page > 1,
        nextPage  : page + 1 ,
        previousPage : page - 1 ,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err =>{
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1 ; //if req.query.page is null then take it as 1
  let totalItems;
  Product.find()
    .countDocuments()
    .then( numProducts =>{
      totalItems = numProducts;
      //to let next then() execute return from current
       return Product.find()
      .skip((page - 1 ) * ITEMS_PER_PAGE)
      .limit(ITEMS_PER_PAGE)
    })
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage :page,
        hasNextPage :ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage : page > 1,
        nextPage  : page + 1 ,
        previousPage : page - 1 ,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err =>{
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
 req.user
    .populate('cart.items.productId')  //usermodel
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err =>{
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error); 
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    }).catch( err =>{
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    })
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
 req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


exports.getCheckout = (req, res ,next) =>{
  let total = 0;
  let products;
  req.user
    .populate('cart.items.productId')  //usermodel => array of products , not only id but the complete product data
    .execPopulate()
    .then(user => {
      products = user.cart.items;

      products.forEach( p =>{
        total = total + p.quantity * p.productId.price;
      })

      //create a stripe session to have  sessionId(key) to use in the checkout.ejs file
       return stripe.checkout.sessions.create({
         payment_method_types:['card'],   // it is an array and it says that we accept credit cards
         line_items:products.map( p =>{    // which items will be checked out
          return {
            name:p.productId.title,
            description:p.productId.description,
            amount: p.productId.price * 100,
            currency:'usd',
            quantity:p.quantity
          };
         }),
            //url where stripe will redirect the user when transaction is succesful or failed.
            success_url: req.protocol + '://' + req.get('host') + '/checkout/success' ,   //http://localhost:3000/checkout/success
            cancel_url:  req.protocol + '://' + req.get('host') + '/checkout/cancel'      //http://localhost:3000/checkout/cancel         
       });
    })
    .then(session =>{
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: products,
        totalSum : total,
        sessionId: session.id
      });
    })
    .catch(err =>{
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error); 
    });

}

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate('cart.items.productId')  //populate????
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId:req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


//read again 
exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')  //populate????
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId:req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })  //user.userId is taken from order model
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


exports.getInvoice = (req, res, next)=>{
 const orderId = req.params.orderId;
  Order.findById(orderId)
  .then(order =>{
     if(!order){
       return next(new Error('No order found'));
     }
     if(order.user.userId.toString() !== req.user._id.toString()){
       return next(new Error(' You are Unauthorized for this order'));
     }
     
     //if the req.userId = order.user.userId then
     const invoiceName = "invoice-" + orderId + '.pdf';
     const invoicePath = path.join('data' ,'invoices' , invoiceName);
     
      const pdfDoc = new PDFDocument();
       res.setHeader('Content-Type' , 'application/pdf');
       res.setHeader('Content-Disposition', 'inline; filename =" ' + invoiceName + '"');

      //generated pdf also get stored to the server   = pdfdoc is a readable stream
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      //return pdf to the client   = res is a writeable stream
      pdfDoc.pipe(res);
      
      //creating a pdf , text() method allows us to write a single line of text into pdf document.
      // pdfDoc.text('hello wordl!');
      pdfDoc.fontSize(26).text('Invoice' ,{
        underline:true
      });

      pdfDoc.text('...........................');
      let totalPrice = 0;
      order.products.forEach(prod => {
         totalPrice = totalPrice + prod.quantity * prod.product.price;
         pdfDoc.fontSize(14).text(
           prod.product.title + ' - ' 
           + prod.quantity + ' x ' 
           + ' $ ' + prod.product.price            
         );
      });
      pdfDoc.text('------');
      pdfDoc.fontSize(20).text('Total Price = $' + totalPrice);

      pdfDoc.end();  //end writing to pdf document.
 
    //  fs.readFile(invoicePath, (err, data )=>{
    //    if(err){
    //      //let the default error handling function work
    //     return next(err);
    //    }
    //    //if no error
    //     res.setHeader('Content-Type' , 'application/pdf');
    //     res.setHeader('Content-Disposition', 'inline; filename =" ' + invoiceName + '"');
    //     res.send(data);
    //  });

    //  const file = fs.createReadStream(invoicePath);
    //  res.setHeader('Content-Type' , 'application/pdf');
    //  res.setHeader('Content-Disposition', 'inline; filename =" ' + invoiceName + '"');
    //  //not every obbject is writeable stream but res object is actualy.  a writeable sream.
    //  file.pipe(res);
     })
  .catch(err => next(err)); 
};