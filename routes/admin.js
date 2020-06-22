const path = require('path');
const express = require('express');
const adminController = require('../controllers/admin');
const isAuth = require('../middleware/isAuth');   //isAuthenticated
const router = express.Router();
const {body} = require('express-validator/check');


// /admin/products => GET
router.get('/products' , isAuth, adminController.getProducts);

// /admin/add-product => GET
router.get('/add-product', isAuth,  adminController.getAddProduct);

// /admin/add-product => POST
router.post('/add-product',
body('title').isString().isLength({ min : 3}).trim(),
body('price').isFloat(),
body('description').isLength({ min:5 , max: 400}).trim()
, isAuth, adminController.postAddProduct);

//get edit product
router.get('/edit-product/:productId' , isAuth, adminController.getEditProduct);

router.post('/edit-product',
body('title').isString().isLength({ min : 3}).trim(),
body('price').isFloat(),
body('description').isLength({ min:5 , max: 400}).trim()
, isAuth , adminController.postEditProduct);

//product/productId is named by yourself thw way you named it in fetch api
router.delete('/product/:productId' , isAuth, adminController.deleteProduct);

module.exports = router;
