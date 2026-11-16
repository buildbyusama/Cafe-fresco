
import ProductItem from './ProductItem';
import { useState, useEffect } from 'react';

const Recipes = () => {

    const [Products, setProducts] = useState([])
    const BASE_URL = import.meta.env.VITE_BASE_URL;

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch(`${BASE_URL}/product/new-releases`);
                const data = await res.json();
                setProducts(data || []);
            } catch (error) {
                console.error('Error fetching products:', error);
            }
        };

        fetchProducts();
    }, []);




    return (
        <>
            <div style={{ marginTop: "100px" }}>
                <h1 className='heading' style={{ fontWeight: "700", textAlign: "center" }}>
                    <span style={{ color: "red" }}>Just dropped</span> Fresh & Flavorful Picks!
                </h1>

                <p className='FlavourWidth' style={{ marginBottom: "90px", textAlign: "center", margin: "0 auto" }}>Discover our selection of delicious and satisfying products. Enjoy a variety of flavors and options to satisfy your cravings.</p>


                <div className='container mt-3'>
                    <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-3 justify-content-center">
                        {Products.map((item, index) => (
                            <div key={index} className="col d-flex justify-content-center">
                                <ProductItem background="rgb(235, 250, 253, 0.89)"
                                    id={item._id}
                                    title={item.title}
                                    details={item.category?.title}
                                    image={item.image}
                                    price={item.price}
                                    discount={item.discount}
                                    stock={item.inventory?.quantityInStock ?? 0}
                                    description={item.description}
                                    image2={item.image2}
                                    isNew={item.newRelease}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

export default Recipes;
