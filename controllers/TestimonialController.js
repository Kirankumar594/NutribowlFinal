import Testimonial from "../models/Testimonial.js";
import path from "path";
import { uploadFile2, deleteFile } from '../middleware/aws.js';

// GET all testimonials
export const getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json(testimonials);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST create a new testimonial
export const createTestimonial = async (req, res) => {
  try {
    const { name, feedback, rating } = req.body;
    const image = await uploadFile2(req.file, "testimonial");

    const testimonial = new Testimonial({
      name,
      feedback,
      rating,
      image,
    });

    const saved = await testimonial.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update an existing testimonial
// export const updateTestimonial = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, feedback, rating } = req.body;
//     const image = await uploadFile2(req.file, "testimonial");

//     const updatedData = {
//       name,
//       feedback,
//       rating,
//     };

//     if (image) updatedData.image = image;

//     const updated = await Testimonial.findByIdAndUpdate(id, updatedData, {
//       new: true,
//     });

//     res.json(updated);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// };

export const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, feedback, rating } = req.body;
    
    // Get the current testimonial first
    const existingTestimonial = await Testimonial.findById(id);
    if (!existingTestimonial) {
      return res.status(404).json({ message: "Testimonial not found" });
    }

    const updatedData = {
      name,
      feedback,
      rating,
      image: existingTestimonial.image, // Keep existing image by default
    };

    // Only process image if a new file was uploaded
    if (req.file) {
      const image = await uploadFile2(req.file, "testimonial");
      if (image) {
        updatedData.image = image;
        
        // Delete old image from S3 if it exists
        if (existingTestimonial.imageKey) {
          try {
            await deleteFile(existingTestimonial.imageKey);
          } catch (deleteError) {
            console.error("Error deleting old image:", deleteError);
          }
        }
      }
    }

    const updated = await Testimonial.findByIdAndUpdate(id, updatedData, {
      new: true,
    });

    res.json(updated);
  } catch (err) {
    console.error("Update Testimonial Error:", err);
    res.status(400).json({ message: err.message });
  }
};

// DELETE a testimonial
export const deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    await Testimonial.findByIdAndDelete(id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
