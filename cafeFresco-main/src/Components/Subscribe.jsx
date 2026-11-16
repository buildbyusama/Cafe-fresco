import { Link } from 'react-router-dom'
import image1 from '../assets/logo/subs-1.png'
import image2 from '../assets/logo/subs-2.png'

// Call to action (there is no newsletter, so no email field that would submit nowhere)
const Subscribe = () => {
    return (
        <div className="container my-5">
            <div className="position-relative overflow-hidden text-center px-3 py-5" style={{ backgroundColor: "#feeab3", borderRadius: "48px" }}>
                <img className="d-none d-lg-block position-absolute start-0 bottom-0" style={{ borderRadius: "105px", maxWidth: 160 }} src={image1} alt="" />
                <img className="d-none d-lg-block position-absolute end-0 top-0" style={{ borderRadius: "41px", maxWidth: 160 }} src={image2} alt="" />
                <div className="position-relative mx-auto" style={{ maxWidth: 600 }}>
                    <h2 className="fw-bold">Questions, catering or <span style={{ color: 'red' }}>big orders</span>?</h2>
                    <p className="mb-4">We&apos;re happy to help with group orders, allergies or anything about your delivery. Send us a message and we&apos;ll get back to you.</p>
                    <Link to="/contact" className="btn btn-dark btn-lg">Get in touch</Link>
                </div>
            </div>
        </div>
    )
}

export default Subscribe
