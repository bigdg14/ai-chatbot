import * as dotenv from "dotenv";
import OpenAI from "openai";
import { Pool } from "pg"; // PostgreSQL connection

dotenv.config({ path: __dirname + "/.env" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Database connection setup
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "products", // Replace with your database name
  password: "admin", // Replace with your password
  port: 5432,
});

export default async function (req, res) {
  if (!openai.apiKey) {
    res.status(500).json({
      error: {
        message: "OpenAI API key not configured",
      },
    });
    return;
  }

  const prompt = req.body.prompt || "";
  if (prompt.trim().length === 0) {
    res.status(400).json({
      error: {
        message: "Please enter a valid prompt",
      },
    });
    return;
  }

  try {
    // Fetch products from the database
    const dbResponse = await pool.query(
      "SELECT name, description FROM products.products"
    );
    const products = dbResponse.rows;
    console.log(products);

    // Combine product data into a formatted string
    const productDescriptions = products
      .map(
        (product) =>
          `Name: ${product.name}, Description: ${product.description}`
      )
      .join("\n");

    console.log(productDescriptions);

    // Generate response using ChatGPT API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Use the following list of products and their descriptions to assist with user queries:\n${productDescriptions}`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 250,
    });

    res.status(200).json({ result: response.choices[0].message.content });
    console.log(response.choices[0].message.content);
  } catch (error) {
    if (error.response) {
      console.log(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error("Error with OpenAI API request or database query:", error);
      res.status(500).json({
        error: {
          message: "An error occurred during your request. Please try again!",
        },
      });
    }
  }
}
