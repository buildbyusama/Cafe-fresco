import { Link } from 'react-router-dom'
import learn from '../assets/logo/chef.svg'

const Learn = () => {
    return (
        <div className="container my-5">
            <div className="row align-items-center g-4">
                <div className="col-12 col-lg-6">
                    <div className="d-flex flex-column gap-3">
                        <h1 className="fw-bold">
                            Unleash your inner <span style={{ color: "red" }}>chef</span> — magic starts in your kitchen
                        </h1>
                        <p>Fresh food, made daily. Every dish is cooked to order from simple, quality ingredients, so what reaches your table tastes like it came straight from our kitchen.</p>
                        <Link to="/about" style={{ width: "120px", borderRadius: "10px", backgroundColor: "#c8102e", border: "none" }} className="btn text-white">
                            Learn more
                        </Link>
                    </div>
                </div>
                <div className="col-12 col-lg-6 text-center">
                    <img src={learn} className="img-fluid" style={{ maxHeight: 490 }} alt="Chef preparing food" />
                </div>
            </div>
        </div>
    )
}

export default Learn
