import { Pool } from "pg";
import fetch from "node-fetch";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/.env" });

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "products", // Replace with your database name
  password: "admin", // Replace with your password
  port: 5432,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST instead." });
    return;
  }

  try {
    const { prompt } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      res
        .status(400)
        .json({ message: "Invalid input. Please provide a valid prompt." });
      return;
    }

    console.log("Received prompt:", prompt);

    // Step 1: Generate the SQL query using Llama
    const flaskResponseSQL = await fetch("http://54.173.180.32:5000/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `
          You are an assistant that converts natural language queries into SQL for a PostgreSQL database with the following schema:
          - Table: products.products
            - Columns: id, name, description
          Only generate 1 SQL query. Be sure to include "products.products" as the table. If the message is unclear, choose the best query from the info provided.
          Generate a SQL query for: "${prompt}"
        `,
      }),
    });

    if (!flaskResponseSQL.ok) {
      const errorText = await flaskResponseSQL.text();
      throw new Error(
        `Flask API error (SQL generation): ${
          errorText || flaskResponseSQL.statusText
        }`
      );
    }

    const sqlResponseData = await flaskResponseSQL.json();
    const sqlQuery = sqlResponseData.response.trim();
    console.log("Generated SQL Query:", sqlQuery);

    // Step 2: Execute the generated SQL query
    const dbResponse = await pool.query(sqlQuery);
    const results = dbResponse.rows;

    console.log("Query Execution Results:", results);

    // Step 3: Generate a user-friendly message using Llama
    const flaskResponseFriendly = await fetch(
      "http://54.173.180.32:5000/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `
            You are an expert assistant who speaks in exciting laymen's terms. Format database query results into a user-friendly message. Examples:
            - Input: [{ "count": "50" }]
            - Output: There are 50 products available.
            - Input: [{ "id": 1, "name": "Product A", "description": "Data on housing prices, sales, and market conditions" }]
            - Output: The 1st product is Product A, which is described as data on housing prices, sales, and market conditions.
            User query: "${prompt}"
            Raw database results: ${JSON.stringify(results)}.
            Without letting the user know, format this into a user-friendly response. Do not ask the user any further questions.
          `,
          messages: [],
        }),
      }
    );

    if (!flaskResponseFriendly.ok) {
      const errorText = await flaskResponseFriendly.text();
      throw new Error(
        `Flask API error (friendly message generation): ${
          errorText || flaskResponseFriendly.statusText
        }`
      );
    }

    const friendlyResponseData = await flaskResponseFriendly.json();
    const responseMessage = friendlyResponseData.response.trim();

    console.log("Friendly Response Message:", responseMessage);

    // Return the response to the client
    res.status(200).json({
      query: sqlQuery,
      message: responseMessage,
      results,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ message: "Error processing the request." });
  }
}
