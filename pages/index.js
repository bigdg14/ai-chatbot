import Head from "next/head";
import { useState, useEffect } from "react";
import styles from "./index.module.css";

export default function Home() {
  const [count, setCount] = useState(0);
  const [promptInput, setPromptInput] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [chatVisible, setChatVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false); // Track hover state
  const [messages, setMessages] = useState([]); // Store chat history
  const [products, setProducts] = useState([]); // Products from DB
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("card"); // "card" or "table"
  const [loading, setLoading] = useState(true);
  const productsPerPage = 12;
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;

  const currentProducts =
    products && products.length > 0
      ? products.slice(indexOfFirstProduct, indexOfLastProduct)
      : [];

  // Fetch products from the backend
  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch("/api/products"); // GET request
        const data = await response.json();
        setProducts(data.products);
        console.log(data.products);
      } catch (error) {
        console.error("Error fetching products:", error);
        setError("Error loading products. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();

    try {
      if (!promptInput.trim()) {
        alert("Please enter a query.");
        return;
      }

      // Call the llamaApi endpoint
      const response = await fetch("/api/llamaApi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptInput, // Current user input
          messages, // Current chat context
        }),
      });

      const data = await response.json();

      if (response.status !== 200) {
        throw new Error(
          data.error || `Request failed with status ${response.status}`
        );
      }

      // Add user's prompt to messages
      const updatedMessages = [
        ...messages,
        { role: "user", content: promptInput },
        { role: "assistant", content: data.message }, // Use server response
      ];

      // Update chat messages with the new context
      setMessages(updatedMessages);

      setResult(data.response); // Optional: Update the result state
      setPromptInput(""); // Clear the input field
      setError(""); // Clear any previous error
    } catch (error) {
      console.error(error);
      setError(error.message); // Show the error to the user
    }
  }


  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      onSubmit(e);
    }
  };

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);

  const toggleChatWindow = () => {
    setChatVisible(!chatVisible);
  };

  return (
    <div className={styles.body}>
      <Head>
        <title>Data Marketplace - Products</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h3>Our Products</h3>

        {/* Toggle View Button */}
        <div className={styles.toggleContainer}>
          <button
            className={`${styles.toggleButton} ${
              viewMode === "card" ? styles.activeToggle : ""
            }`}
            onClick={() => setViewMode("card")}
          >
            Card View
          </button>
          <button
            className={`${styles.toggleButton} ${
              viewMode === "table" ? styles.activeToggle : ""
            }`}
            onClick={() => setViewMode("table")}
          >
            Table View
          </button>
        </div>

        {/* Product Display */}
        {loading ? (
          <p>Loading products...</p>
        ) : error ? (
          <p style={{ color: "red" }}>{error}</p>
        ) : !products || products.length === 0 ? (
          <p>No products available.</p>
        ) : (
          <>
            {viewMode === "card" && (
              <div className={styles.cardGrid}>
                {currentProducts.map((product) => (
                  <div key={product.id} className={styles.card}>
                    <h4>{product.name}</h4>
                    <p>{product.description}</p>
                  </div>
                ))}
              </div>
            )}

            {viewMode === "table" && (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {currentProducts.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {products.length > 0 && (
              <div className={styles.pagination}>
                {Array.from(
                  { length: Math.ceil(products.length / productsPerPage) },
                  (_, index) => (
                    <button
                      key={index + 1}
                      className={`${styles.pageButton} ${
                        currentPage === index + 1 ? styles.activePage : ""
                      }`}
                      onClick={() => handlePageChange(index + 1)}
                    >
                      {index + 1}
                    </button>
                  )
                )}
              </div>
            )}
          </>
        )}

        {/* Chat Feature */}
        <button
          className={styles.chatButton}
          onClick={toggleChatWindow}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          Chat
        </button>

        {(chatVisible || isHovered) && (
          <div
            className={styles.chatWindow}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => !chatVisible && setIsHovered(false)}
          >
            <div className={styles.chatHeader}>Chat with Us</div>
            <div className={styles.chatMessages}>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === "user"
                      ? styles.userMessage
                      : styles.assistantMessage
                  }
                >
                  {message.content}
                </div>
              ))}
            </div>
            <div className={styles.chatInput}>
              <input
                type="text"
                name="prompt"
                placeholder="Ask about our products..."
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={handleKeyDown} // Trigger submission on Enter key press
              />
              <button type="submit" onClick={onSubmit}>
                Send
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
