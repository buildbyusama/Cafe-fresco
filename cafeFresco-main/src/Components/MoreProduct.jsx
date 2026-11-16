import PropTypes from 'prop-types';
import ProductItem from './ProductItem';
import { useState, useEffect } from 'react';


const MoreRecepies = (props) => {

    const [Products, setProducts] = useState([])
    const BASE_URL = import.meta.env.VITE_BASE_URL;

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch(`${BASE_URL}/product/featured`);
                const data = await res.json();
                setProducts(data || []);
            } catch (error) {
                console.error('Error fetching products:', error);
            }
        };

        fetchProducts();
    }, []);


    const displayedProducts = Products.slice(0, props.count);

    return (

        <div>

            {props.count === 8 && (
                <div className="d-flex columnFlex" style={{ justifyContent: "space-around", marginTop: "100px" }}>
                    <h1 className='heading headingLearn center' style={{ fontWeight: 700, width: "445px" }}>
                        Bring joy to your table with this <span style={{ color: 'red' }}>irresistible</span> recipe!
                    </h1>
                    <p className='headingLearn center' style={{ width: "500px" }}>
                        Hand-picked favourites from our kitchen — freshly made, packed with flavour and ready to order.
                    </p>
                </div>
            )}

            {props.count === 4 && (
                <div className="d-flex heading headingLearn center" style={{ justifyContent: "space-around", marginTop: "100px" }}>
                    <h1 style={{ fontWeight: 700, width: "700px" }}>
                        <span style={{ color: "red" }}>Craving more?</span> Try these recipes too
                    </h1>


                </div>
            )}

            <div style={{ marginTop: "60px" }}>


                <div className='container mt-3'>
                    <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-3 justify-content-center">
                        {displayedProducts.map((item, index) => (
                            <div key={index} className="col d-flex justify-content-center">
                                <ProductItem
                                    id={item._id}
                                    title={item.title}
                                    details={item.category?.title}
                                    image={item.image}
                                    price={item.price}
                                    discount={item.discount}
                                    stock={item.inventory?.quantityInStock ?? 0}
                                    isFeatured={item.featured}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div >
    )
}

export default MoreRecepies

MoreRecepies.propTypes = {
    count: PropTypes.number,
};
