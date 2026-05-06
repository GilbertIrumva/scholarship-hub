import { useState, useEffect } from "react";
import {
  getAllScholarships,
  createScholarship,
} from "./services/scholarship";
import Detail from "./components/Detail";

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("");
  const [status, setStatus] = useState("");
  const [contact, setContact] = useState("");
  const [age, setAge] = useState("");
  const [activeSection, setActiveSection] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const scholarships = await getAllScholarships();
      setData(scholarships);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavClick = (sectionId) => {
    setActiveSection(sectionId);
    setMenuOpen(false);
    scrollToSection(sectionId);
  };

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem('darkMode', JSON.stringify(newMode));
      return newMode;
    });
  };

  // When form is submitted
  const handleSubmit = async (e) => {
    e.preventDefault();

    const newPerson = {
      name: name,
      nationality: nationality,
      status: status,
      contact: contact,
      age: Number(age)
    };

    try {
      await createScholarship(newPerson);

      await fetchData();

      setName("");
      setNationality("");
      setStatus("");
      setContact("");
      setAge("");
    } catch (err) {
      setError(err.message);
      console.error("Error submitting form:", err);
    }
  };

  return (
    <div className={darkMode ? "dark-theme" : ""} style={{ backgroundColor: darkMode ? "#07101f" : "#ffffff", color: darkMode ? "#eaf0fb" : "#111111" }}>
      <style>{`
        .site-nav .nav-links {
          flex-wrap: wrap;
          justify-content: center;
          display: flex;
        }

        .site-nav .nav-toggle {
          display: none;
          border: none;
          border-radius: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.3s, transform 0.3s;
        }

        .site-nav .theme-toggle {
          display: inline-flex;
          border: none;
          border-radius: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.3s, transform 0.3s;
          background-color: rgba(255,255,255,0.12);
          color: #ecf0f1;
        }

        .site-nav .nav-toggle:hover,
        .site-nav .theme-toggle:hover {
          transform: translateY(-1px);
        }

        .site-nav.open .nav-links {
          display: flex !important;
        }

        .hero-section {
          padding: 50px 20px;
        }

        .hero-section h2 {
          font-size: 42px;
        }

        .hero-section p {
          font-size: 18px;
        }

        .hero-stats {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .section-grid,
        .page-grid,
        .contact-grid,
        .footer-grid {
          display: grid;
          gap: 30px;
        }

        .page-grid,
        .contact-grid,
        .footer-grid {
          grid-template-columns: 1fr 1fr;
        }

        .application-form {
          max-width: 100%;
          padding: 0 10px;
        }

        .grid-two-col {
          grid-template-columns: 1fr 1fr;
        }

        .dark-theme .site-nav {
          background-color: #0b1f36 !important;
        }

        .dark-theme .site-nav .theme-toggle {
          background-color: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        .section-card {
  padding: 25px !important;
  border-radius: 10px;
}

.section-card h1,
.section-card h2,
.section-card h3,
.section-card h4 {
  margin-bottom: 12px;
  display: block;
}

.section-card p,
.section-card ul,
.section-card ol {
  margin-top: 0;
  line-height: 1.7;
}

        .dark-theme .site-nav .nav-links a {
          color: #ffffff !important;
        }

        .dark-theme .hero-section h2,
        .dark-theme .hero-section p,
        .dark-theme .hero-section .section-card,
        .dark-theme .section-card,
        .dark-theme footer,
        .dark-theme .footer-grid > div,
        .dark-theme .page-grid > div,
        .dark-theme .contact-grid > div,
        .dark-theme h1,
        .dark-theme h2,
        .dark-theme h3,
        .dark-theme h4,
        .dark-theme p,
        .dark-theme li,
        .dark-theme span,
        .dark-theme div {
          color: #ffffff !important;
        }

        .dark-theme .section-card {
          background-color: #0f2748 !important;
          border-color: #173656 !important;
        }

        .dark-theme .hero-section {
          background: linear-gradient(135deg, rgba(4, 17, 38, 0.55) 0%, rgba(12, 38, 69, 0.7) 100%), url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80');
        }

        .dark-theme #how-to-apply {
          background-color: #0a1929 !important;
        }

        .dark-theme .site-nav .theme-toggle,
        .dark-theme .site-nav .nav-toggle {
          background-color: rgba(255,255,255,0.12);
          color: #ecf0f1;
        }

        .dark-theme input,
        .dark-theme select,
        .dark-theme textarea {
          background-color: #1a365d !important;
          color: #ffffff !important;
          border-color: #2d3748 !important;
        }

        .dark-theme input::placeholder,
        .dark-theme select::placeholder,
        .dark-theme textarea::placeholder {
          color: #a0aec0 !important;
        }

        .dark-theme button:not(.theme-toggle):not(.nav-toggle) {
          background-color: #2b6cb0 !important;
          color: #ffffff !important;
        }

        .dark-theme table {
          background-color: #0f2748 !important;
          color: #ffffff !important;
        }

        .dark-theme table th,
        .dark-theme table td {
          border-color: #2d3748 !important;
          color: #e7f1ff !important;
        }

        .dark-theme table th {
          background-color: #060c14 !important;
        }

        @media (max-width: 2000px) {
          .site-nav .nav-toggle {
            display: inline-flex;
          }

          .site-nav .nav-links {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
          }

          .hero-section {
            padding: 40px 18px;
          }

          .hero-section h2 {
            font-size: 36px;
          }

          .hero-section p {
            font-size: 17px;
          }

          .page-grid,
          .contact-grid,
          .footer-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 680px) {
          .site-nav .nav-links {
            flex-direction: column !important;
            align-items: stretch;
            gap: 12px !important;
            display: none !important;
          }

          .site-nav.open .nav-links {
            display: flex !important;
          }

          .site-nav .nav-links a {
            width: 100%;
            text-align: center;
          }

          .site-nav .nav-toggle,
          .site-nav .theme-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .hero-section {
            padding: 30px 16px;
          }

          .hero-section h2 {
            font-size: 30px;
          }

          .hero-section p {
            font-size: 15px;
            max-width: none;
          }

          .hero-stats {
            grid-template-columns: 1fr !important;
          }

          .grid-two-col {
            grid-template-columns: 1fr !important;
          }

          .page-grid,
          .contact-grid,
          .footer-grid {
            grid-template-columns: 1fr !important;
          }

          .footer-grid {
            text-align: center;
          }

          .footer-grid > div {
            justify-self: center;
          }

          .application-form {
            padding: 0 8px;
          }
        }

      `}
      
      
      </style>

      <nav className={`site-nav ${menuOpen ? "open" : ""} ${darkMode ? "dark-theme" : ""}`} style={{
        backgroundColor: darkMode ? "#0e2a4a" : "#2c3e50",
        padding: "15px 0",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ecf0f1" }}>
            Scholarship Hub
          </div>

          <ul className="nav-links" style={{
            listStyle: "none",
            display: "flex",
            gap: "30px",
            margin: 0,
            padding: 0
          }}>
            <li>
              <a href="#home" onClick={(e) => { e.preventDefault(); handleNavClick('home'); }} style={{
                color: "#ecf0f1",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "500",
                padding: "8px 16px",
                borderRadius: "4px",
                transition: "background-color 0.3s",
                cursor: "pointer",
                backgroundColor: activeSection === 'home' ? "rgba(255,255,255,0.18)" : "transparent"
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.target.style.backgroundColor = activeSection === 'home' ? "rgba(255,255,255,0.18)" : "transparent"}>
                Home
              </a>
            </li>
        
            <li>
              <a href="#about" onClick={(e) => { e.preventDefault(); handleNavClick('about'); }} style={{
                color: "#ecf0f1",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "500",
                padding: "8px 16px",
                borderRadius: "4px",
                transition: "background-color 0.3s",
                cursor: "pointer",
                backgroundColor: activeSection === 'about' ? "rgba(255,255,255,0.18)" : "transparent"
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.target.style.backgroundColor = activeSection === 'about' ? "rgba(255,255,255,0.18)" : "transparent"}>
                About
              </a>
            </li>

               <li>
              <a href="#how-to-apply" onClick={(e) => { e.preventDefault(); handleNavClick('how-to-apply'); }} style={{
                color: "#ecf0f1",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "500",
                padding: "8px 16px",
                borderRadius: "4px",
                transition: "background-color 0.3s",
                cursor: "pointer",
                backgroundColor: activeSection === 'how-to-apply' ? "rgba(255,255,255,0.18)" : "transparent"
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.target.style.backgroundColor = activeSection === 'how-to-apply' ? "rgba(255,255,255,0.18)" : "transparent"}>
                How to Apply
              </a>
            </li>


           
            <li>
              <a href="#contact" onClick={(e) => { e.preventDefault(); handleNavClick('contact'); }} style={{
                color: "#ecf0f1",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: "500",
                padding: "8px 16px",
                borderRadius: "4px",
                transition: "background-color 0.3s",
                cursor: "pointer",
                backgroundColor: activeSection === 'contact' ? "rgba(255,255,255,0.18)" : "transparent"
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.target.style.backgroundColor = activeSection === 'contact' ? "rgba(255,255,255,0.18)" : "transparent"}>
                Contact
              </a>
            </li>
          </ul>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleDarkMode}
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "#ecf0f1",
                border: "1px solid rgba(255,255,255,0.18)",
                padding: "10px 14px",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>
            <button
              type="button"
              className="nav-toggle"
              onClick={toggleMenu}
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "#ecf0f1",
                border: "1px solid rgba(255,255,255,0.18)",
                padding: "10px 14px",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      <div id="app-container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 20px 20px 20px" }}>


        {/* HOME SECTION */}
        <section id="home" style={{ padding: "40px 0" }}>
          <h1 style={{
            background: darkMode 
              ? "none"
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            backgroundClip: darkMode ? "unset" : "text",
            WebkitBackgroundClip: darkMode ? "unset" : "text",
            WebkitTextFillColor: darkMode ? "#ffffff" : "transparent",
            color: darkMode ? "#ffffff" : "transparent",
            fontSize: "3.5rem",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "20px",
            textShadow: darkMode ? "2px 2px 4px rgba(255,255,255,0.1)" : "2px 2px 4px rgba(0,0,0,0.1)",
            position: "relative"
          }}>Scholarship Application</h1>

          {/* HERO SECTION */}


          <div className="hero-section" style={{
            background: "linear-gradient(135deg, rgba(44, 94, 128, 0.49) 0%, rgba(131, 55, 152, 0.55) 100%), url('https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: "16px",
            padding: "60px 40px",
            marginBottom: "40px",
            color: "white",
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(43, 32, 32, 0.3)",
              zIndex: 1
            }}></div>

            <div style={{ position: "relative", zIndex: 2 }}>
              <h2 style={{
                fontSize: "48px",
                fontWeight: "700",
                marginBottom: "20px",
                textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                lineHeight: "1.2"
              }}>
                Your Future Starts Here
              </h2>

              <p style={{
                fontSize: "20px",
                marginBottom: "30px",
                opacity: "0.95",
                maxWidth: "600px",
                margin: "0 auto 30px auto",
                lineHeight: "1.6"
              }}>
                Join thousands of successful scholars who have transformed their lives through our comprehensive scholarship program. Excellence, opportunity, and success await.
              </p>

              {/* Statistics Grid */}

              <div className="hero-stats" style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "30px",
                marginBottom: "40px",
                maxWidth: "800px",
                margin: "0 auto 40px auto"
              }}>
                <div style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  padding: "25px",
                  borderRadius: "12px",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.2)"
                }}>
                  <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>500+</div>
                  <div style={{ fontSize: "16px", opacity: "0.9" }}>Scholars Supported</div>
                </div>

                <div style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  padding: "25px",
                  borderRadius: "12px",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.2)"
                }}>
                  <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>$1k+</div>
                  <div style={{ fontSize: "16px", opacity: "0.9" }}>Awards Distributed</div>
                </div>

                <div style={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  padding: "25px",
                  borderRadius: "12px",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.2)"
                }}>
                  <div style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "8px" }}>95%</div>
                  <div style={{ fontSize: "16px", opacity: "0.9" }}>Success Rate</div>
                </div>
              </div>

              <button
                onClick={() => scrollToSection('application-form')}
                style={{
                  backgroundColor: "#fff",
                  color: "#0a529b",
                  border: "none",
                  padding: "16px 32px",
                  borderRadius: "50px",
                  fontSize: "18px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px"
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = "translateY(-3px)";
                  e.target.style.boxShadow = "0 8px 25px rgba(0,0,0,0.3)";
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
                }}
              >
                 Apply Now
                <span style={{ fontSize: "20px" }}>→</span>
              </button>
            </div>
          </div>

          {/* SCHOLARSHIP DESCRIPTION */}
          <div className="section-card" style={{
            marginBottom: "30px",
            padding: "20px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #dee2e6",
            fontSize: "16px",
            lineHeight: "1.6"
          }}>
            <h2 style={{ color: "#2c3e50", marginBottom: "15px" }}>Excellence in Education Scholarship Program</h2>

            <p style={{ marginBottom: "15px" }}>
              Our scholarship program is designed to recognize and support exceptional individuals who demonstrate outstanding academic achievement, leadership potential, and a commitment to making a positive impact in their communities. We believe that education is the foundation of progress, and our comprehensive criteria ensure that we identify candidates who not only excel academically but also embody the values of integrity, perseverance, and innovation that will drive future advancements in their chosen fields.
            </p>

            <p style={{ marginBottom: "15px" }}>
              What sets our scholarship apart is our holistic approach to evaluation. We look beyond mere test scores and GPA to understand the complete picture of each applicant's journey. Our criteria emphasize diversity of thought, cultural background, and unique life experiences that enrich our global community. We prioritize applicants who have overcome challenges, demonstrated leadership in their communities, and shown a genuine passion for learning and growth. This inclusive approach ensures that our scholarships reach those who will truly benefit and contribute meaningfully to society.
            </p>

            <p>
              Looking forward, our commitment extends beyond financial support. We provide ongoing mentorship, networking opportunities, and professional development resources to help our scholars thrive in their academic and career pursuits. Our way forward is built on partnership and collaboration, working closely with educational institutions, industry leaders, and community organizations to create pathways for success. We envision a future where our scholars become the next generation of innovators, leaders, and change-makers who will shape a better world for all.
            </p>
          </div>

          {error && <p style={{ color: "red" }}>Error: {error}</p>}


        </section>


        {/* ABOUT SECTION */}
        <section id="about" style={{
          padding: "40px 0",
          backgroundColor: darkMode ? "#0f2748" : "#f8f9fa",
          margin: "40px 0",
          borderRadius: "8px",
          scrollMarginTop: "110px"
        }}>
          <h2 style={{ color: darkMode ? "#e7f1ff" : "#2c3e50", marginBottom: "20px" }}>About Our Scholarship Program</h2>

          <div className="page-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", alignItems: "start" }}>
            <div>
              <h3 style={{ color: darkMode ? "#e7f1ff" : "#34495e", marginBottom: "15px" }}>Our Mission</h3>
              <p style={{ lineHeight: "1.6", marginBottom: "20px", color: darkMode ? "#e7f1ff" : "inherit" }}>
                To empower exceptional students worldwide by providing comprehensive scholarships that not only cover educational expenses but also foster personal growth, leadership development, and community engagement. We believe that every deserving student should have the opportunity to pursue their dreams without financial barriers.
              </p>

              <h3 style={{ color: darkMode ? "#e7f1ff" : "#34495e", marginBottom: "15px" }}>Eligibility Criteria</h3>
              <ul style={{ lineHeight: "1.8", color: darkMode ? "#e7f1ff" : "inherit" }}>
                <li>Outstanding academic performance (minimum GPA 3.5/4.0)</li>
                <li>Demonstrated leadership in school or community</li>
                <li>Commitment to social impact and positive change</li>
                <li>Financial need consideration</li>
                <li>Diversity and inclusion values</li>
              </ul>
            </div>

            <div>
              <h3 style={{ color: darkMode ? "#e7f1ff" : "#34495e", marginBottom: "15px" }}>What We Offer</h3>
              <ul style={{ lineHeight: "1.8", color: darkMode ? "#e7f1ff" : "inherit" }}>
                <li>Full tuition coverage for selected programs</li>
                <li>Monthly stipend for living expenses</li>
                <li>Mentorship program with industry leaders</li>
                <li>Networking opportunities and career guidance</li>
                <li>Access to exclusive workshops and seminars</li>
                <li>International exchange program opportunities</li>
              </ul>

              <h3 style={{ color: darkMode ? "#e7f1ff" : "#34495e", marginBottom: "15px", marginTop: "20px" }}>Application Timeline</h3>
              <p style={{ lineHeight: "1.6", color: darkMode ? "#e7f1ff" : "inherit" }}>
                <strong>Application Period:</strong> January 1 - March 31<br/>
                <strong>Review Process:</strong> April 1 - May 15<br/>
                <strong>Final Decisions:</strong> May 30<br/>
                <strong>Scholarship Start:</strong> September 1
              </p>
            </div>
          </div>
        </section>

          {/* HOW TO APPLY SECTION */}
        <section id="how-to-apply" style={{ padding: "40px 0", backgroundColor: "#eef6ff", margin: "40px 0", borderRadius: "8px", scrollMarginTop: "110px" }}>
          <h2 style={{ color: "#2c3e50", marginBottom: "20px", padding: "20px" }}>How to Apply</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "25px" }}>
            <div className="section-card" style={{ backgroundColor: "white", padding: "25px", borderRadius: "10px", border: "1px solid #dce7f1" }}>
              <h3 style={{ marginBottom: "15px", color: "#34495e" }}>Application Overview</h3>
              <p style={{ lineHeight: "1.8", color: "#58616b" }}>
                To apply for our scholarship, please follow the steps below. The application form is located on the Home section above, and each field is clearly explained here so you can complete your submission accurately.
              </p>
            </div>

            <div className="section-card" style={{ backgroundColor: "white", padding: "25px", borderRadius: "10px", border: "1px solid #dce7f1" }}>
              <h3 style={{ marginBottom: "15px", color: "#34495e" }}>Step-by-Step Instructions</h3>
              <ol style={{ marginLeft: "18px", lineHeight: "1.8", color: "#58616b" }}>
                <li><strong>Read the eligibility criteria</strong> in the About section to confirm you qualify.</li>
                <li><strong>Review the required fields</strong> below so you understand how each one is used.</li>
                <li><strong>Open the form</strong> in the Home section and fill each field carefully.</li>
                <li><strong>Submit the application</strong> and wait for confirmation from our team.</li>
                <li><strong>Track your application</strong> by keeping the confirmation details for follow-up.</li>
              </ol>
            </div>

            <div className="grid-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div className="section-card" style={{ backgroundColor: "white", padding: "20px", borderRadius: "10px", border: "1px solid #dce7f1" }}>
                <h4 style={{ marginBottom: "12px", color: "#34495e" }}>Form Field Guide</h4>
                <ul style={{ lineHeight: "1.8", color: "#58616b" }}>
                  <li><strong>Name:</strong> Enter your full legal name.</li>
                  <li><strong>Nationality:</strong> Provide your country of citizenship.</li>
                  <li><strong>Status:</strong> Select your current academic or professional standing.</li>
                </ul>
              </div>
              <div className="section-card" style={{ backgroundColor: "white", padding: "20px", borderRadius: "10px", border: "1px solid #dce7f1" }}>
                <h4 style={{ marginBottom: "12px", color: "#34495e" }}>Additional Details</h4>
                <ul style={{ lineHeight: "1.8", color: "#58616b" }}>
                  <li><strong>Contact:</strong> Use a valid email or phone number.</li>
                  <li><strong>Age:</strong> Enter your current age as a number.</li>
                  <li><strong>Submission Tip:</strong> Double-check all fields before sending.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FORM */}
          <div id="application-form" className="application-form section-card" style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.07)",
            border: "1px solid #e9ecef",
            scrollMarginTop: "110px",
            marginTop: "30px"
          }}>
            <h3 style={{
              color: "#2c3e50",
              marginBottom: "25px",
              textAlign: "center",
              fontSize: "24px",
              fontWeight: "600"
            }}>
              Application Form
            </h3>

            <form onSubmit={handleSubmit} style={{ maxWidth: "600px", margin: "0 auto" }}>
              <div style={{ display: "grid", gap: "20px" }}>

                <div className="section-card" style={{
                  backgroundColor: "#f8f9fa",
                  padding: "20px",
                  borderRadius: "8px",
                  border: "1px solid #dee2e6"
                }}>
                  <h4 style={{
                    color: "#495057",
                    marginBottom: "15px",
                    fontSize: "18px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                     Personal Information
                  </h4>

                  <div className="grid-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    <div>
                      <label style={{
                        display: "block",
                        marginBottom: "5px",
                        fontWeight: "500",
                        color: "#495057",
                        fontSize: "14px"
                      }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "16px",
                          transition: "border-color 0.3s",
                          outline: "none",
                          boxSizing: "border-box"
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#007bff"}
                        onBlur={(e) => e.target.style.borderColor = "#dee2e6"}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: "block",
                        marginBottom: "5px",
                        fontWeight: "500",
                        color: "#495057",
                        fontSize: "14px"
                      }}>
                        Age *
                      </label>
                      <input
                        type="number"
                        placeholder="Your age"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        required
                        min="16"
                        max="100"
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "16px",
                          transition: "border-color 0.3s",
                          outline: "none",
                          boxSizing: "border-box"
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#007bff"}
                        onBlur={(e) => e.target.style.borderColor = "#dee2e6"}
                      />
                    </div>
                  </div>
                </div>

                <div className="section-card" style={{
                  backgroundColor: "#f8f9fa",
                  padding: "20px",
                  borderRadius: "8px",
                  border: "1px solid #dee2e6"
                }}>
                  <h4 style={{
                    color: "#495057",
                    marginBottom: "15px",
                    fontSize: "18px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                     Academic & Professional Information
                  </h4>

                  <div className="grid-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                    <div>
                      <label style={{
                        display: "block",
                        marginBottom: "5px",
                        fontWeight: "500",
                        color: "#495057",
                        fontSize: "14px"
                      }}>
                        Nationality *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Kenyan, American"
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "16px",
                          transition: "border-color 0.3s",
                          outline: "none",
                          boxSizing: "border-box"
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#007bff"}
                        onBlur={(e) => e.target.style.borderColor = "#dee2e6"}
                      />
                    </div>

                    <div>
                      <label style={{
                        display: "block",
                        marginBottom: "5px",
                        fontWeight: "500",
                        color: "#495057",
                        fontSize: "14px"
                      }}>
                        Current Status *
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        required
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          border: "2px solid #dee2e6",
                          borderRadius: "6px",
                          fontSize: "16px",
                          transition: "border-color 0.3s",
                          outline: "none",
                          boxSizing: "border-box",
                          backgroundColor: "white"
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#007bff"}
                        onBlur={(e) => e.target.style.borderColor = "#dee2e6"}
                      >
                        <option value="Select your status"></option>
                        <option value="High School Student">High School Student</option>
                        <option value="Undergraduate Student">Undergraduate Student</option>
                        <option value="Graduate Student">Graduate Student</option>
                        <option value="Diploma">Diploma </option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="section-card" style={{
                  backgroundColor: "#f8f9fa",
                  padding: "20px",
                  borderRadius: "8px",
                  border: "1px solid #dee2e6"
                }}>
                  <h4 style={{
                    color: "#495057",
                    marginBottom: "15px",
                    fontSize: "18px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                     Contact Information
                  </h4>

                  <div>
                    <label style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "500",
                      color: "#495057",
                      fontSize: "14px"
                    
                    }}>
                      Email or Phone Number *
                    </label>
                    <input
                      type="text"
                      placeholder="your.email@example.com"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        border: "2px solid #dee2e6",
                        borderRadius: "6px",
                        fontSize: "16px",
                        transition: "border-color 0.3s",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "#007bff"}
                      onBlur={(e) => e.target.style.borderColor = "#dee2e6"}
                    />
                    
                  </div>
                </div>

                <div className="section-card" style={{
                  backgroundColor: "#e8f5e8",
                  padding: "25px",
                  borderRadius: "8px",
                  border: "1px solid #d4edda",
                  textAlign: "center"
                }}>
                  <p style={{
                    marginBottom: "20px",
                    color: "#155724",
                    fontSize: "16px",
                    lineHeight: "1.5"
                  }}>
                    <strong>Ready to submit?</strong> Please review all information above before submitting your scholarship application.
                    Our team will review your application and contact you within 2-3 weeks.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      backgroundColor: loading ? "#6c757d" : "#28a745",
                      color: "white",
                      border: "none",
                      padding: "15px 40px",
                      borderRadius: "8px",
                      fontSize: "18px",
                      fontWeight: "600",
                      cursor: loading ? "not-allowed" : "pointer",
                      transition: "all 0.3s",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      minWidth: "200px"
                    }}
                    onMouseOver={(e) => {
                      if (!loading) {
                        e.target.style.backgroundColor = "#218838";
                        e.target.style.transform = "translateY(-2px)";
                        e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.15)";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!loading) {
                        e.target.style.backgroundColor = "#28a745";
                        e.target.style.transform = "translateY(0)";
                        e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                      }
                    }}
                  >
                    {loading ? "Submitting Application..." : "Submit Application"}
                  </button>
                </div>

              </div>
            </form>
          </div>

        {/* APPLICANTS LIST (from backend) */}
        <section id="applicants" style={{
          padding: "40px 0",
          backgroundColor: darkMode ? "#0f2748" : "#ffffff",
          margin: "40px 0",
          borderRadius: "8px",
          scrollMarginTop: "110px"
        }}>
          <h2 style={{ color: darkMode ? "#e7f1ff" : "#2c3e50", marginBottom: "20px", textAlign: "center" }}>
            Current Applicants
          </h2>

          {loading && <p style={{ textAlign: "center" }}>Loading applicants…</p>}
          {error && <p style={{ color: "red", textAlign: "center" }}>Error: {error}</p>}

          {!loading && !error && (
            <div style={{ overflowX: "auto", padding: "0 20px" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                backgroundColor: darkMode ? "#0f2748" : "#ffffff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                borderRadius: "8px",
                overflow: "hidden"
              }}>
                <thead>
                  <tr style={{ backgroundColor: darkMode ? "#060c14" : "#2c3e50", color: "#ffffff" }}>
                    <th style={{ padding: "12px", textAlign: "left" }}>ID</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Name</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Nationality</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Contact</th>
                    <th style={{ padding: "12px", textAlign: "left" }}>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                      <td style={{ padding: "10px" }}>{item.id}</td>
                      <td style={{ padding: "10px" }}>{item.name}</td>
                      <td style={{ padding: "10px" }}>{item.nationality}</td>
                      <td style={{ padding: "10px" }}>{item.status}</td>
                      <td style={{ padding: "10px" }}>{item.contact}</td>
                      <td style={{ padding: "10px" }}>{item.age}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: "none" }}>
                {data.map((item) => (
                  <Detail key={`detail-${item.id}`} data={item} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* CONTACT SECTION */}
        <section id="contact" style={{
          padding: "40px 0",
          backgroundColor: darkMode ? "#0f2748" : "#f8f9fa",
          margin: "40px 0",
          borderRadius: "8px",
          scrollMarginTop: "110px"
        }}>
          <h2 style={{ color: darkMode ? "#e7f1ff" : "#2c3e50", marginBottom: "20px" }}>Contact Us</h2>

          <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "start" }}>
            <div>
              <h3 style={{ color: darkMode ? "#e7f1ff" : "#34495e", marginBottom: "15px" }}>Get In Touch</h3>
              <p style={{ lineHeight: "1.6", marginBottom: "20px", color: darkMode ? "#e7f1ff" : "inherit" }}>
                Have questions about our scholarship program? We're here to help! Reach out to our team for assistance with your application, eligibility requirements, or any other inquiries.
              </p>

              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: darkMode ? "#e7f1ff" : "#34495e", marginBottom: "10px" }}>Contact Information</h4>
                <p style={{ color: darkMode ? "#e7f1ff" : "inherit" }}><strong>Email:</strong> scholarships@scholarshiphub.org</p>
                <p style={{ color: darkMode ? "#e7f1ff" : "inherit" }}><strong>Phone:</strong> +254 757003887</p>
                <p style={{ color: darkMode ? "#e7f1ff" : "inherit" }}><strong>Address:</strong> 123 Burundian Market Street, Turkana, Kakuma, Kenya</p>
              </div>

              <div>
                <h4 style={{ color: darkMode ? "#e7f1ff" : "#34495e", marginBottom: "10px" }}>Office Hours</h4>
                <p style={{ color: darkMode ? "#e7f1ff" : "inherit" }}>Monday - Friday: 9:00 AM - 6:00 PM</p>
                <p style={{ color: darkMode ? "#e7f1ff" : "inherit" }}>Saturday: 10:00 AM - 4:00 PM</p>
                <p style={{ color: darkMode ? "#e7f1ff" : "inherit" }}>Sunday: Closed</p>
              </div>
            </div>

            <div>
              <h3 style={{ color: darkMode ? "#e7f1ff" : "#34495e", marginBottom: "15px" }}>Frequently Asked Questions</h3>

              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: darkMode ? "#e7f1ff" : "#34495e", fontSize: "16px", marginBottom: "8px" }}>When is the application deadline?</h4>
                <p style={{ marginBottom: "15px", lineHeight: "1.5", color: darkMode ? "#e7f1ff" : "inherit" }}>The application deadline is april 31st. We recommend submitting your application as early as possible to avoid any technical issues.</p>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: darkMode ? "#e7f1ff" : "#34495e", fontSize: "16px", marginBottom: "8px" }}>How are recipients selected?</h4>
                <p style={{ marginBottom: "15px", lineHeight: "1.5", color: darkMode ? "#e7f1ff" : "inherit" }}>Recipients are selected based on academic excellence, leadership potential, community involvement, and financial need through a comprehensive review process.</p>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ color: darkMode ? "#e7f1ff" : "#34495e", fontSize: "16px", marginBottom: "8px" }}>Can international students apply?</h4>
                <p style={{ marginBottom: "15px", lineHeight: "1.5", color: darkMode ? "#e7f1ff" : "inherit" }}>Yes! Our scholarship program is open to students from all countries. We celebrate diversity and welcome applications from international students.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ backgroundColor: "#2c3e50", color: "#ecf0f1", padding: "30px 20px", borderRadius: "12px", marginTop: "30px" }}>
          <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", maxWidth: "1200px", margin: "0 auto" }}>
            <div>
              <h3 style={{ marginBottom: "15px" }}>Scholarship Hub</h3>
              <p style={{ lineHeight: "1.8", color: "#dfe6ea" }}>
                Our mission is to support ambitious students with financial aid, mentorship, and opportunities that accelerate their academic and professional growth.
              </p>
            </div>
            <div>
              <h3 style={{ marginBottom: "15px" }}>Contact</h3>
              <p style={{ lineHeight: "1.8", color: "#dfe6ea" }}><strong>Email:</strong> scholarships@scholarshiphub.org</p>
              <p style={{ lineHeight: "1.8", color: "#dfe6ea" }}><strong>Phone:</strong> +254 757003887</p>
              <p style={{ lineHeight: "1.8", color: "#dfe6ea" }}><strong>Office:</strong> 123 Burundian Market Street, Kakuma, Kenya</p>
            </div>
          </div>
          <div style={{ marginTop: "25px", textAlign: "center", color: "#b2bec3" }}>
            © 2026 Scholarship Hub. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;