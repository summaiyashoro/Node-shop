const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const {check , body} = require('express-validator/check');  //validation
const User = require('../models/user');


router.get('/login' , authController.getLogin );
router.post('/login', 
[
   body('email').isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
     //check for password
    body('password', 'Please Enter a valid password')
    .isLength({min :5 })
    .isAlphanumeric()
    .trim()
]
,authController.postLogin);

router.post('/logout' , authController.postLogout);

router.get('/signup' , authController.getSignup);
router.post('/signup' ,
[
    //check for email
 check('email').isEmail().withMessage('Please enter a valid email')
 .custom( (value , {req}) =>{   //value = email
    //   if(value === 'test@test.com'){
    //     throw new Error('This type of email is forbidden');
    // }  return true;

     //check if email already exists
      return  User.findOne({email:value})
      .then( (userDoc)=>{
         if(userDoc){
           return Promise.reject('Email already exists , pick a different one!');
               }
          });
       }).normalizeEmail(),
     //check for password
    body('password', 'password must contain only numbers and text and atleast 5 characters')
    .isLength({min :5 })
    .isAlphanumeric()
    .trim(),
    body('confirmPassword').trim()
    .custom(( value, {req}) =>{
    if(value !== req.body.password){
        throw new Error('Password does not match');
    }
    return true;
    })
  ]
, authController.postSignup);


router.get('/reset', authController.getReset);
router.post('/reset', authController.postReset);

//get new password , token the same name used in getnewpassword controller
router.get('/reset/:token', authController.getNewPassword);
router.post('/new-password' , authController.postNewPassword);

module.exports = router;