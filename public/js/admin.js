//this code will run on client side not on server side.

const deleteProduct = (btn) =>{
    //parentNode will return the tag where the input field is inside of .
    const prodId = btn.parentNode.querySelector('[name=productId]').value;
    const csrf = btn.parentNode.querySelector('[name=_csrf]').value;

    const productElement = btn.closest('article');  //get  the tag where all info of product exists

    //sending network  request to the server at route = > /admin/product/:prodid
    fetch('/admin/product/'+ prodId ,{
         method:'DELETE',
         headers:{
             'csrf-token':csrf
         }
     })
     .then(result =>{
         //send result as json
         return result.json(); //json return a promise
     })
     .then(data =>{
         console.log(data);
         //immediately removes the product from frontent when a product is deleted.
         productElement.parentNode.removeChild(productElement);
     })
     .catch(err =>{
         console.log(err);
     })
}